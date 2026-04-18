import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BookOpen, Plus, Download, FileText, Search, CreditCard as Edit2, Trash2, Save, X, ChevronDown, ChevronUp, Shield, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { usePageTitle } from '../contexts/PageTitleContext';
import { supplierService } from '../services/supplierService';
import { Grootboekrekening, GrootboekCategory } from '../types/supplier';
import { grootboekCategoryLabels } from '../utils/grootboekTemplate';
import { generateGrootboekPDF } from '../lib/generateGrootboekPDF';

const CATEGORIES: { value: GrootboekCategory; label: string }[] = Object.entries(grootboekCategoryLabels).map(
  ([value, label]) => ({ value: value as GrootboekCategory, label })
);

const BTW_OPTIONS = [
  { value: '', label: 'Geen BTW' },
  { value: 'hoog', label: 'Hoog (21%)' },
  { value: 'laag', label: 'Laag (9%)' },
  { value: 'geen', label: 'Vrijgesteld (0%)' },
  { value: 'verlegd', label: 'Verlegd' },
];

// Mapping van Excel "Type" kolom naar GrootboekCategory
const EXCEL_TYPE_TO_CATEGORY: Record<string, GrootboekCategory> = {
  'vaste activa': 'vaste_activa',
  'overige activa': 'vlottende_activa',
  'cumulatieve afschrijvingen': 'afschrijvingen',
  'eigen vermogen': 'eigen_vermogen',
  'vlottende activa': 'vlottende_activa',
  'liquide middelen': 'liquide_middelen',
  'kortlopende schulden': 'kortlopende_schulden',
  'langlopende schulden': 'langlopende_schulden',
  'omzet': 'omzet',
  'kostprijs omzet': 'kostprijs_omzet',
  'personeelskosten': 'personeelskosten',
  'huisvestingskosten': 'huisvestingskosten',
  'exploitatiekosten': 'exploitatiekosten',
  'financiele baten en lasten': 'financiele_baten_lasten',
  'financiële baten en lasten': 'financiele_baten_lasten',
  'overige baten en lasten': 'overige',
  'overige': 'overige',
};

function mapExcelTypeToCategory(excelType: string): GrootboekCategory {
  const key = excelType.toLowerCase().trim();
  return EXCEL_TYPE_TO_CATEGORY[key] || 'overige';
}

function detectDelimiter(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount >= semicolonCount && tabCount >= commaCount) return '\t';
  if (semicolonCount >= commaCount) return ';';
  return ',';
}

function parseExcelOrCSV(content: string): Array<{
  code: string;
  name: string;
  category: GrootboekCategory;
  type: 'debet' | 'credit';
}> {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().trim());

  // Detecteer kolom-indexen op basis van headers
  let codeIdx = headers.findIndex(h => h === 'code' || h === 'rekeningnummer' || h === 'nr');
  let nameIdx = headers.findIndex(h =>
    h === 'omschrijving' || h === 'naam' || h === 'name' || h === 'description'
  );
  let typeIdx = headers.findIndex(h => h === 'type' || h === 'soort' || h === 'categorie');
  let bwIdx = headers.findIndex(h =>
    h.includes('balans') || h.includes('winst') || h.includes('verlies')
  );
  let dcIdx = headers.findIndex(h =>
    h.includes('debet') || h.includes('credit') || h === 'dc' || h === 'd/c'
  );

  // Fallback: positie-gebaseerd als headers niet herkend worden
  if (codeIdx === -1) codeIdx = 0;
  if (nameIdx === -1) nameIdx = 1;
  if (typeIdx === -1) typeIdx = 2;
  if (bwIdx === -1) bwIdx = 3;
  if (dcIdx === -1) dcIdx = 4;

  const results: Array<{ code: string; name: string; category: GrootboekCategory; type: 'debet' | 'credit' }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const code = cols[codeIdx]?.trim();
    const name = cols[nameIdx]?.trim();
    if (!code || !name) continue;

    const excelType = cols[typeIdx]?.trim() || '';
    const dcRaw = cols[dcIdx]?.trim().toLowerCase() || '';
    const dc: 'debet' | 'credit' = dcRaw === 'credit' || dcRaw === 'c' ? 'credit' : 'debet';

    results.push({
      code,
      name,
      category: mapExcelTypeToCategory(excelType),
      type: dc,
    });
  }

  return results;
}

const Grootboekrekeningen: React.FC = () => {
  const { userRole } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Rekeningschema');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rekeningen, setRekeningen] = useState<Grootboekrekening[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'overige' as GrootboekCategory,
    type: 'debet' as 'debet' | 'credit',
    btw: '' as string,
  });
  const [saving, setSaving] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<Array<{
    code: string; name: string; category: GrootboekCategory; type: 'debet' | 'credit';
  }>>([]);
  const [importFileName, setImportFileName] = useState('');

  if (userRole !== 'admin') {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState icon={Shield} title="Geen toegang" description="Alleen administrators kunnen het rekeningschema beheren" />
      </div>
    );
  }

  const loadData = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      const data = await supplierService.getGrootboekrekeningen(selectedCompany.id);
      setRekeningen(data);
    } catch (e) {
      console.error('Error loading grootboekrekeningen:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = rekeningen.filter(
    (r) =>
      !searchTerm ||
      r.code.includes(searchTerm) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (grootboekCategoryLabels[r.category as keyof typeof grootboekCategoryLabels] || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const grouped = filtered.reduce((acc, r) => {
    const label = grootboekCategoryLabels[r.category as keyof typeof grootboekCategoryLabels] || r.category;
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {} as Record<string, Grootboekrekening[]>);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', category: 'overige', type: 'debet', btw: '' });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!selectedCompany || !formData.code.trim() || !formData.name.trim()) {
      showError('Fout', 'Code en naam zijn verplicht');
      return;
    }
    try {
      setSaving(true);
      await supplierService.addGrootboekrekening(
        selectedCompany.id,
        formData.code.trim(),
        formData.name.trim(),
        formData.category,
        formData.type,
        formData.btw ? (formData.btw as 'hoog' | 'laag' | 'geen' | 'verlegd') : undefined
      );
      success('Toegevoegd', `${formData.code} - ${formData.name} aangemaakt`);
      resetForm();
      setShowAddModal(false);
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekening niet toevoegen');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: Grootboekrekening) => {
    setEditingId(r.id || null);
    setFormData({
      code: r.code,
      name: r.name,
      category: r.category,
      type: r.type || 'debet',
      btw: r.btw || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      setSaving(true);
      await supplierService.updateGrootboekrekening(editingId, {
        code: formData.code.trim(),
        name: formData.name.trim(),
        category: formData.category,
        type: formData.type,
        btw: formData.btw ? (formData.btw as 'hoog' | 'laag' | 'geen' | 'verlegd') : undefined,
      });
      success('Opgeslagen', 'Rekening bijgewerkt');
      resetForm();
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekening niet bijwerken');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Grootboekrekening) => {
    if (!r.id) return;
    if (!confirm(`Weet je zeker dat je ${r.code} - ${r.name} wilt verwijderen?`)) return;
    try {
      await supplierService.deleteGrootboekrekening(r.id);
      success('Verwijderd', `${r.code} verwijderd`);
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekening niet verwijderen');
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedCompany) return;
    try {
      setDeletingAll(true);
      await supplierService.clearGrootboekrekeningen(selectedCompany.id);
      success('Verwijderd', 'Alle grootboekrekeningen zijn verwijderd');
      setShowDeleteAllModal(false);
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekeningen niet verwijderen');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleImportTemplate = async () => {
    if (!selectedCompany) return;
    try {
      setImportingTemplate(true);
      const count = await supplierService.importGrootboekTemplate(selectedCompany.id);
      if (count > 0) {
        success('Geïmporteerd', `${count} standaard rekeningen aangemaakt`);
        loadData();
      } else {
        success('Rekeningschema', 'Alle standaard rekeningen bestaan al');
      }
    } catch (e: any) {
      showError('Fout', e.message || 'Kon sjabloon niet importeren');
    } finally {
      setImportingTemplate(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        let parsed: Array<{ code: string; name: string; category: GrootboekCategory; type: 'debet' | 'credit' }> = [];

        if (isXlsx) {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

          parsed = rows
            .map((row) => {
              const keys = Object.keys(row).map(k => k.toLowerCase().trim());
              const getVal = (candidates: string[]) => {
                for (const c of candidates) {
                  const key = Object.keys(row).find(k => k.toLowerCase().trim() === c);
                  if (key) return String(row[key]).trim();
                }
                return '';
              };

              const code = getVal(['code', 'rekeningnummer', 'nr']);
              const name = getVal(['omschrijving', 'naam', 'name', 'description']);
              const excelType = getVal(['type', 'soort', 'categorie']);
              const dcRaw = getVal(['debet / credit', 'debet/credit', 'dc', 'd/c', 'type debet credit']).toLowerCase();
              const dc: 'debet' | 'credit' = dcRaw === 'credit' || dcRaw === 'c' ? 'credit' : 'debet';

              if (!code || !name) return null;
              return { code, name, category: mapExcelTypeToCategory(excelType), type: dc };
            })
            .filter(Boolean) as typeof parsed;
        } else {
          const content = ev.target?.result as string;
          if (!content) {
            showError('Fout', 'Bestand kon niet worden gelezen');
            return;
          }
          parsed = parseExcelOrCSV(content);
        }

        if (parsed.length === 0) {
          showError('Fout', 'Geen geldige rijen gevonden. Controleer de kolomnamen (Code, Omschrijving, Type, Debet / Credit).');
          return;
        }

        setImportPreviewData(parsed);
        setShowImportPreview(true);
      } catch {
        showError('Fout', 'Bestand kon niet worden verwerkt. Controleer het formaat.');
      }
    };

    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'UTF-8');
    }

    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!selectedCompany || importPreviewData.length === 0) return;
    try {
      setImportingExcel(true);

      const existing = await supplierService.getGrootboekrekeningen(selectedCompany.id);
      const existingCodes = new Set(existing.map(r => r.code));

      let added = 0;
      let skipped = 0;

      for (const row of importPreviewData) {
        if (existingCodes.has(row.code)) {
          skipped++;
          continue;
        }
        await supplierService.addGrootboekrekening(
          selectedCompany.id,
          row.code,
          row.name,
          row.category,
          row.type
        );
        added++;
      }

      success('Geïmporteerd', `${added} rekeningen toegevoegd${skipped > 0 ? `, ${skipped} al bestaand overgeslagen` : ''}`);
      setShowImportPreview(false);
      setImportPreviewData([]);
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Importeren mislukt');
    } finally {
      setImportingExcel(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState icon={BookOpen} title="Geen bedrijf geselecteerd" description="Selecteer eerst een bedrijf" />
      </div>
    );
  }

  const FormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="bijv. 4100"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debet' | 'credit' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="debet">Debet</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Naam</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="bijv. Kantoorkosten"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categorie</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as GrootboekCategory })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BTW</label>
          <select
            value={formData.btw}
            onChange={(e) => setFormData({ ...formData, btw: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {BTW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt,.tsv"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rekeningschema</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {rekeningen.length} rekeningen in {Object.keys(grouped).length} categorieën
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => { resetForm(); setShowAddModal(true); }} variant="outline" className="text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Toevoegen
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="text-sm"
            title="CSV of TSV bestand uploaden (geëxporteerd vanuit Excel)"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Excel import
          </Button>
          <Button onClick={handleImportTemplate} disabled={importingTemplate} variant="outline" className="text-sm">
            {importingTemplate ? <LoadingSpinner size="sm" /> : <><Upload className="w-4 h-4 mr-1" />Sjabloon</>}
          </Button>
          {rekeningen.length > 0 && (
            <>
              <Button onClick={() => generateGrootboekPDF(rekeningen, selectedCompany.name)} variant="outline" className="text-sm">
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button
                onClick={() => setShowDeleteAllModal(true)}
                variant="outline"
                className="text-sm text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Alles verwijderen
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <div className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Zoek op code, naam of categorie..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : rekeningen.length === 0 ? (
        <Card>
          <div className="p-8 sm:p-12 text-center">
            <BookOpen className="w-12 sm:w-16 h-12 sm:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nog geen rekeningschema</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              Importeer het standaard MKB-rekeningschema, upload een Excel CSV-bestand of voeg handmatig rekeningen toe.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button onClick={handleImportTemplate} disabled={importingTemplate}>
                {importingTemplate ? <LoadingSpinner size="sm" /> : <><Download className="w-4 h-4 mr-2" />Importeer standaard rekeningschema</>}
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel CSV uploaden
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([category, accounts]) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <Card key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-400 truncate">{category}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full flex-shrink-0">
                      {accounts.length}
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                {!isCollapsed && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <div className="hidden sm:block">
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <th className="text-left px-4 py-2 w-20">Code</th>
                            <th className="text-left px-4 py-2">Naam</th>
                            <th className="text-left px-4 py-2 w-16">Type</th>
                            <th className="text-left px-4 py-2 w-20">BTW</th>
                            <th className="text-right px-4 py-2 w-24">Acties</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((r) => (
                            <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              {editingId === r.id ? (
                                <>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={formData.code}
                                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                      className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={formData.name}
                                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                      className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <select
                                      value={formData.type}
                                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debet' | 'credit' })}
                                      className="w-full px-1 py-1 text-xs border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                    >
                                      <option value="debet">D</option>
                                      <option value="credit">C</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-2">
                                    <select
                                      value={formData.btw}
                                      onChange={(e) => setFormData({ ...formData, btw: e.target.value })}
                                      className="w-full px-1 py-1 text-xs border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                    >
                                      {BTW_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.value || '-'}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={handleSaveEdit} disabled={saving} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded">
                                        <Save className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={resetForm} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-2">
                                    <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{r.code}</span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{r.name}</td>
                                  <td className="px-4 py-2">
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                      r.type === 'debet'
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    }`}>
                                      {r.type === 'debet' ? 'D' : 'C'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2">
                                    {r.btw && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400">{r.btw}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={() => handleEdit(r)} className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded">
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDelete(r)} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="sm:hidden divide-y divide-gray-50 dark:divide-gray-800">
                      {accounts.map((r) => (
                        <div key={r.id} className="p-3">
                          {editingId === r.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={formData.code}
                                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                  placeholder="Code"
                                  className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                />
                                <select
                                  value={formData.type}
                                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debet' | 'credit' })}
                                  className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                >
                                  <option value="debet">Debet</option>
                                  <option value="credit">Credit</option>
                                </select>
                              </div>
                              <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Naam"
                                className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              />
                              <select
                                value={formData.btw}
                                onChange={(e) => setFormData({ ...formData, btw: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              >
                                {BTW_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={saving}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-white bg-green-600 rounded-lg"
                                >
                                  <Save className="w-3.5 h-3.5" /> Opslaan
                                </button>
                                <button
                                  onClick={resetForm}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg"
                                >
                                  <X className="w-3.5 h-3.5" /> Annuleren
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{r.code}</span>
                                  <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                                    r.type === 'debet'
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  }`}>
                                    {r.type === 'debet' ? 'D' : 'C'}
                                  </span>
                                  {r.btw && (
                                    <span className="text-[10px] text-gray-400">{r.btw}</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-900 dark:text-white mt-0.5 truncate">{r.name}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(r)} className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Rekening toevoegen */}
      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="Nieuwe grootboekrekening" size="md">
          <div className="space-y-4">
            <FormFields />
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>Annuleren</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <LoadingSpinner size="sm" /> : <><Plus className="w-4 h-4 mr-1" />Toevoegen</>}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Alles verwijderen bevestiging */}
      <Modal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        title="Alle rekeningen verwijderen"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Onomkeerbare actie</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                Je staat op het punt om alle <strong>{rekeningen.length} grootboekrekeningen</strong> van{' '}
                <strong>{selectedCompany.name}</strong> te verwijderen. Dit kan niet ongedaan worden gemaakt.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeleteAllModal(false)} disabled={deletingAll}>
              Annuleren
            </Button>
            <Button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              {deletingAll ? <LoadingSpinner size="sm" /> : <><Trash2 className="w-4 h-4 mr-1" />Ja, alles verwijderen</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Excel import preview */}
      <Modal
        isOpen={showImportPreview}
        onClose={() => { setShowImportPreview(false); setImportPreviewData([]); }}
        title={`Excel import — ${importFileName}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>{importPreviewData.length} rekeningen</strong> gevonden. Bestaande codes worden overgeslagen.
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-3 py-2">Code</th>
                  <th className="text-left px-3 py-2">Naam</th>
                  <th className="text-left px-3 py-2">Categorie</th>
                  <th className="text-left px-3 py-2">D/C</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {importPreviewData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-3 py-1.5 font-mono text-blue-600 dark:text-blue-400 font-bold">{row.code}</td>
                    <td className="px-3 py-1.5 text-gray-900 dark:text-white">{row.name}</td>
                    <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs">
                      {grootboekCategoryLabels[row.category as keyof typeof grootboekCategoryLabels] || row.category}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        row.type === 'debet'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {row.type === 'debet' ? 'D' : 'C'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => { setShowImportPreview(false); setImportPreviewData([]); }} disabled={importingExcel}>
              Annuleren
            </Button>
            <Button onClick={handleConfirmImport} disabled={importingExcel}>
              {importingExcel ? <LoadingSpinner size="sm" /> : <><Download className="w-4 h-4 mr-1" />Importeren</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Grootboekrekeningen;
