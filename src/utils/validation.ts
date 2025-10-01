// BSN validatie volgens 11-proef
export function validateBSN(bsn: string): boolean {
  // Verwijder spaties en streepjes
  const cleaned = bsn.replace(/[\s-]/g, '');
  
  // Moet 9 cijfers zijn
  if (!/^\d{9}$/.test(cleaned)) return false;
  
  // 11-proef
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(cleaned[i]) * (9 - i);
  }
  sum -= parseInt(cleaned);
  
  return sum % 11 === 0;
}

// IBAN validatie
export function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  
  // Nederlandse IBAN: NL + 2 cijfers + 4 letters + 10 cijfers
  if (!/^NL\d{2}[A-Z]{4}\d{10}$/.test(cleaned)) return false;
  
  // MOD-97 check
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (char) => 
    (char.charCodeAt(0) - 55).toString()
  );
  
  let remainder = numeric;
  while (remainder.length > 2) {
    const block = remainder.slice(0, 9);
    remainder = (parseInt(block) % 97).toString() + remainder.slice(block.length);
  }
  
  return parseInt(remainder) % 97 === 1;
}

// Postcode validatie (1234 AB formaat)
export function validatePostalCode(postalCode: string): boolean {
  return /^\d{4}\s?[A-Z]{2}$/i.test(postalCode);
}

// Telefoonnummer validatie (Nederlands)
export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(\+31|0031|0)[1-9]\d{8}$/.test(cleaned);
}