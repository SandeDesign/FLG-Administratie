import { GrootboekCategory } from '../types/supplier';

export interface GrootboekTemplateEntry {
  code: string;
  name: string;
  category: GrootboekCategory;
  type: 'debet' | 'credit';
  btw?: 'hoog' | 'laag' | 'geen' | 'verlegd';
}

/**
 * Standaard Nederlands rekeningschema (grootboekrekeningen)
 * Gebaseerd op het MKB-basisrekeningschema (RGS-compatible)
 *
 * 0xxx - Vaste activa
 * 1xxx - Vlottende activa & Liquide middelen
 * 2xxx - Eigen vermogen & Langlopende schulden
 * 3xxx - Kortlopende schulden
 * 4xxx - Omzet
 * 5xxx - Kostprijs omzet (inkoopkosten)
 * 6xxx - Personeelskosten
 * 7xxx - Huisvestings- en exploitatiekosten
 * 8xxx - Afschrijvingen & Financiele baten/lasten
 * 9xxx - Overige / Tussenrekeningen
 */
export const grootboekTemplate: GrootboekTemplateEntry[] = [
  // 0xxx - Vaste activa
  { code: '0100', name: 'Goodwill', category: 'vaste_activa', type: 'debet' },
  { code: '0200', name: 'Inventaris en inrichting', category: 'vaste_activa', type: 'debet' },
  { code: '0210', name: 'Computers en software', category: 'vaste_activa', type: 'debet' },
  { code: '0220', name: 'Machines en installaties', category: 'vaste_activa', type: 'debet' },
  { code: '0230', name: 'Bedrijfsauto\'s', category: 'vaste_activa', type: 'debet' },
  { code: '0240', name: 'Gereedschappen', category: 'vaste_activa', type: 'debet' },
  { code: '0300', name: 'Verbouwingen', category: 'vaste_activa', type: 'debet' },

  // 1xxx - Vlottende activa & Liquide middelen
  { code: '1000', name: 'Kas', category: 'liquide_middelen', type: 'debet' },
  { code: '1100', name: 'Bank (hoofdrekening)', category: 'liquide_middelen', type: 'debet' },
  { code: '1110', name: 'Bank (spaarrekening)', category: 'liquide_middelen', type: 'debet' },
  { code: '1120', name: 'Bank (tweede rekening)', category: 'liquide_middelen', type: 'debet' },
  { code: '1200', name: 'Debiteuren', category: 'vlottende_activa', type: 'debet' },
  { code: '1300', name: 'Nog te ontvangen bedragen', category: 'vlottende_activa', type: 'debet' },
  { code: '1310', name: 'Vooruitbetaalde bedragen', category: 'vlottende_activa', type: 'debet' },
  { code: '1400', name: 'Te vorderen BTW (hoog)', category: 'vlottende_activa', type: 'debet', btw: 'hoog' },
  { code: '1410', name: 'Te vorderen BTW (laag)', category: 'vlottende_activa', type: 'debet', btw: 'laag' },
  { code: '1500', name: 'Voorraad', category: 'vlottende_activa', type: 'debet' },
  { code: '1510', name: 'Onderhanden werk', category: 'vlottende_activa', type: 'debet' },
  { code: '1600', name: 'Kruisposten', category: 'vlottende_activa', type: 'debet' },

  // 2xxx - Eigen vermogen & Langlopende schulden
  { code: '2000', name: 'Eigen vermogen / Kapitaal', category: 'eigen_vermogen', type: 'credit' },
  { code: '2010', name: 'Agioreserve', category: 'eigen_vermogen', type: 'credit' },
  { code: '2050', name: 'Winstreserve', category: 'eigen_vermogen', type: 'credit' },
  { code: '2060', name: 'Resultaat lopend boekjaar', category: 'eigen_vermogen', type: 'credit' },
  { code: '2100', name: 'Prive-opname', category: 'eigen_vermogen', type: 'debet' },
  { code: '2110', name: 'Prive-storting', category: 'eigen_vermogen', type: 'credit' },
  { code: '2200', name: 'Leningen (langlopend)', category: 'langlopende_schulden', type: 'credit' },
  { code: '2210', name: 'Hypotheek', category: 'langlopende_schulden', type: 'credit' },
  { code: '2300', name: 'Lease-verplichtingen', category: 'langlopende_schulden', type: 'credit' },

  // 3xxx - Kortlopende schulden
  { code: '3000', name: 'Crediteuren', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3100', name: 'Af te dragen BTW (hoog)', category: 'kortlopende_schulden', type: 'credit', btw: 'hoog' },
  { code: '3110', name: 'Af te dragen BTW (laag)', category: 'kortlopende_schulden', type: 'credit', btw: 'laag' },
  { code: '3120', name: 'BTW afdracht', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3200', name: 'Loonheffing', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3210', name: 'Pensioenpremies', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3220', name: 'Sociale lasten', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3300', name: 'Vennootschapsbelasting', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3400', name: 'Nog te betalen bedragen', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3410', name: 'Vooruit ontvangen bedragen', category: 'kortlopende_schulden', type: 'credit' },
  { code: '3500', name: 'Rekening-courant directie', category: 'kortlopende_schulden', type: 'credit' },

  // 4xxx - Omzet
  { code: '4000', name: 'Omzet dienstverlening', category: 'omzet', type: 'credit', btw: 'hoog' },
  { code: '4010', name: 'Omzet producten', category: 'omzet', type: 'credit', btw: 'hoog' },
  { code: '4020', name: 'Omzet projecten', category: 'omzet', type: 'credit', btw: 'hoog' },
  { code: '4030', name: 'Omzet detachering / uitzendwerk', category: 'omzet', type: 'credit', btw: 'hoog' },
  { code: '4040', name: 'Omzet onderhoud', category: 'omzet', type: 'credit', btw: 'hoog' },
  { code: '4100', name: 'Omzet BTW laag tarief', category: 'omzet', type: 'credit', btw: 'laag' },
  { code: '4200', name: 'Omzet BTW verlegd', category: 'omzet', type: 'credit', btw: 'verlegd' },
  { code: '4300', name: 'Omzet export (0% BTW)', category: 'omzet', type: 'credit', btw: 'geen' },
  { code: '4900', name: 'Overige opbrengsten', category: 'omzet', type: 'credit' },

  // 5xxx - Kostprijs omzet / Inkoopkosten
  { code: '5000', name: 'Inkoopkosten materialen', category: 'kostprijs_omzet', type: 'debet', btw: 'hoog' },
  { code: '5010', name: 'Inkoopkosten handelsgoederen', category: 'kostprijs_omzet', type: 'debet', btw: 'hoog' },
  { code: '5020', name: 'Uitbesteed werk / onderaannemers', category: 'kostprijs_omzet', type: 'debet', btw: 'hoog' },
  { code: '5030', name: 'Ingehuurd personeel (uitzendkrachten)', category: 'kostprijs_omzet', type: 'debet', btw: 'hoog' },
  { code: '5040', name: 'Overige directe projectkosten', category: 'kostprijs_omzet', type: 'debet', btw: 'hoog' },

  // 6xxx - Personeelskosten
  { code: '6000', name: 'Bruto lonen en salarissen', category: 'personeelskosten', type: 'debet' },
  { code: '6010', name: 'Vakantiegeld', category: 'personeelskosten', type: 'debet' },
  { code: '6020', name: 'Overuren / toeslagen', category: 'personeelskosten', type: 'debet' },
  { code: '6100', name: 'Sociale lasten werkgever', category: 'personeelskosten', type: 'debet' },
  { code: '6110', name: 'Pensioenpremie werkgever', category: 'personeelskosten', type: 'debet' },
  { code: '6200', name: 'Reiskostenvergoeding', category: 'personeelskosten', type: 'debet' },
  { code: '6210', name: 'Onkostenvergoedingen', category: 'personeelskosten', type: 'debet' },
  { code: '6220', name: 'Studiekosten / opleiding', category: 'personeelskosten', type: 'debet' },
  { code: '6230', name: 'Bedrijfskleding / PBM', category: 'personeelskosten', type: 'debet' },
  { code: '6300', name: 'Uitzendkosten', category: 'personeelskosten', type: 'debet' },
  { code: '6400', name: 'Arbokosten / verzuim', category: 'personeelskosten', type: 'debet' },
  { code: '6500', name: 'Overige personeelskosten', category: 'personeelskosten', type: 'debet' },

  // 7xxx - Huisvestings- en exploitatiekosten
  { code: '7000', name: 'Huurkosten bedrijfspand', category: 'huisvestingskosten', type: 'debet', btw: 'hoog' },
  { code: '7010', name: 'Energie (gas, water, elektra)', category: 'huisvestingskosten', type: 'debet', btw: 'hoog' },
  { code: '7020', name: 'Schoonmaakkosten', category: 'huisvestingskosten', type: 'debet', btw: 'hoog' },
  { code: '7030', name: 'Onderhoud bedrijfspand', category: 'huisvestingskosten', type: 'debet', btw: 'hoog' },
  { code: '7040', name: 'Onroerende zaakbelasting', category: 'huisvestingskosten', type: 'debet' },
  { code: '7100', name: 'Kantoorbenodigdheden', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7110', name: 'Telefoon en internet', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7120', name: 'Portokosten', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7130', name: 'Software en licenties', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7140', name: 'Hosting en domeinkosten', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7200', name: 'Autokosten (brandstof)', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7210', name: 'Autokosten (onderhoud)', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7220', name: 'Autokosten (verzekering)', category: 'exploitatiekosten', type: 'debet' },
  { code: '7230', name: 'Autokosten (wegenbelasting)', category: 'exploitatiekosten', type: 'debet' },
  { code: '7240', name: 'Autokosten (lease)', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7300', name: 'Verzekeringen', category: 'exploitatiekosten', type: 'debet' },
  { code: '7310', name: 'Administratiekosten', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7320', name: 'Accountantskosten', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7330', name: 'Advieskosten (juridisch)', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7340', name: 'Advieskosten (overig)', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7400', name: 'Reclame en marketing', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7410', name: 'Representatiekosten', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7420', name: 'Contributies en abonnementen', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7500', name: 'Gereedschap en klein materiaal', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },
  { code: '7900', name: 'Overige bedrijfskosten', category: 'exploitatiekosten', type: 'debet', btw: 'hoog' },

  // 8xxx - Afschrijvingen & Financiele baten/lasten
  { code: '8000', name: 'Afschrijving inventaris', category: 'afschrijvingen', type: 'debet' },
  { code: '8010', name: 'Afschrijving computers', category: 'afschrijvingen', type: 'debet' },
  { code: '8020', name: 'Afschrijving machines', category: 'afschrijvingen', type: 'debet' },
  { code: '8030', name: 'Afschrijving bedrijfsauto\'s', category: 'afschrijvingen', type: 'debet' },
  { code: '8040', name: 'Afschrijving goodwill', category: 'afschrijvingen', type: 'debet' },
  { code: '8050', name: 'Afschrijving verbouwingen', category: 'afschrijvingen', type: 'debet' },
  { code: '8100', name: 'Rentekosten leningen', category: 'financiele_baten_lasten', type: 'debet' },
  { code: '8110', name: 'Rentekosten rekening-courant', category: 'financiele_baten_lasten', type: 'debet' },
  { code: '8120', name: 'Bankkosten', category: 'financiele_baten_lasten', type: 'debet' },
  { code: '8200', name: 'Rentebaten', category: 'financiele_baten_lasten', type: 'credit' },
  { code: '8300', name: 'Boekwinst/-verlies activa', category: 'financiele_baten_lasten', type: 'debet' },

  // 9xxx - Tussenrekeningen
  { code: '9000', name: 'Tussenrekening', category: 'overige', type: 'debet' },
  { code: '9100', name: 'Vraagposten', category: 'overige', type: 'debet' },
  { code: '9200', name: 'Memoriaal', category: 'overige', type: 'debet' },
];

export const grootboekCategoryLabels: Record<GrootboekCategory, string> = {
  vaste_activa: 'Vaste activa (0xxx)',
  vlottende_activa: 'Vlottende activa (1xxx)',
  liquide_middelen: 'Liquide middelen (1xxx)',
  eigen_vermogen: 'Eigen vermogen (2xxx)',
  langlopende_schulden: 'Langlopende schulden (2xxx)',
  kortlopende_schulden: 'Kortlopende schulden (3xxx)',
  omzet: 'Omzet (4xxx)',
  kostprijs_omzet: 'Kostprijs omzet / Inkoop (5xxx)',
  personeelskosten: 'Personeelskosten (6xxx)',
  huisvestingskosten: 'Huisvestingskosten (7xxx)',
  exploitatiekosten: 'Exploitatiekosten (7xxx)',
  afschrijvingen: 'Afschrijvingen (8xxx)',
  financiele_baten_lasten: 'Financiele baten en lasten (8xxx)',
  overige: 'Overige / Tussenrekeningen (9xxx)',
};
