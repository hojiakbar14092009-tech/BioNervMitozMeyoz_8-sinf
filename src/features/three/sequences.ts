// Genetic code as printed in Biologiya 10, fig. 2.26 (iRNK codons → amino acid names).
const TABLE: Record<string, string> = {};
const add = (name: string, codons: string) => codons.split(' ').forEach((c) => (TABLE[c] = name));
add('fenilalanin', 'UUU UUC');
add('leysin', 'UUA UUG CUU CUC CUA CUG');
add('izoleysin', 'AUU AUC AUA');
add('metionin', 'AUG');
add('valin', 'GUU GUC GUA GUG');
add('serin', 'UCU UCC UCA UCG AGU AGC');
add('prolin', 'CCU CCC CCA CCG');
add('treonin', 'ACU ACC ACA ACG');
add('alanin', 'GCU GCC GCA GCG');
add('tirozin', 'UAU UAC');
add('stop', 'UAA UAG UGA');
add('gistidin', 'CAU CAC');
add('glutamin', 'CAA CAG');
add('asparagin', 'AAU AAC');
add('lizin', 'AAA AAG');
add('asparagin kislota', 'GAU GAC');
add('glutamin kislota', 'GAA GAG');
add('sistein', 'UGU UGC');
add('triptofan', 'UGG');
add('arginin', 'CGU CGC CGA CGG AGA AGG');
add('glitsin', 'GGU GGC GGA GGG');

export const GENETIC_CODE: Readonly<Record<string, string>> = TABLE;

const DNA_PAIR: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
const RNA_FROM_DNA: Record<string, string> = { A: 'U', T: 'A', G: 'C', C: 'G' };
const RNA_PAIR: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' };

export const complementDNA = (s: string) => [...s].map((b) => DNA_PAIR[b] ?? '?').join('');
/** Transcription of a template DNA strand (book example: A-C-G-T-G-A → U-G-C-A-C-U). */
export const transcribe = (s: string) => [...s].map((b) => RNA_FROM_DNA[b] ?? '?').join('');
export const anticodon = (codon: string) => [...codon].map((b) => RNA_PAIR[b] ?? '?').join('');
export const codons = (rna: string) => rna.match(/.{1,3}/g) ?? [];

// Book p.72, task 5 sequence (starts with AUG, ends with UAG).
export const TRANSLATION_CODONS = 'AUG CUG UGC UCU UGC GGU ACG CGU CCC ACC UAG'.split(' ').map((codon) => ({
  codon,
  anticodon: anticodon(codon),
  amino: GENETIC_CODE[codon],
}));
