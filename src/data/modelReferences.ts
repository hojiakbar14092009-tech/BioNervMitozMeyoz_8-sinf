import type { BookId, SceneKey, TopicKey } from '../types';

/**
 * Visual-direction references (docs/reference-images). They define look and composition only;
 * biological facts and labels always come from the lesson PDFs.
 */
export interface ModelReference {
  referenceFile: string;
  bookId: BookId;
  topicKeys: TopicKey[];
  scene: SceneKey | 'microscope';
  mode?: 'mitosis' | 'meiosis' | 'compare';
  intendedSubject: string;
  visualTraits: string[];
}

export const modelReferences: ModelReference[] = [
  {
    referenceFile: '10-2-14-virtual-mikroskop.webp',
    bookId: 'grade10',
    topicKeys: ['grade10-2-14'],
    scene: 'microscope',
    intendedSubject: 'Piyoz ildizi uchi preparati, mitoz fazalari',
    visualTraits: ['stained lavender cell walls', 'pink granular cytoplasm', 'dark-violet chromatin', 'circular eyepiece field', '10×/40× objectives', 'selected-cell close-up'],
  },
  {
    referenceFile: '8-41-orqa-miya-kesimi.webp',
    bookId: 'grade8',
    topicKeys: ['grade8-41'],
    scene: 'spinalCord',
    intendedSubject: 'Orqa miyaning ko‘ndalang kesimi',
    visualTraits: ['cream white matter slab', 'mauve-brown butterfly grey matter', 'dark central canal', 'fanned yellow root fibre bundles', 'golden spinal ganglion'],
  },
  {
    referenceFile: '10-2-12-mitoz.webp',
    bookId: 'grade10',
    topicKeys: ['grade10-2-12'],
    scene: 'division',
    mode: 'mitosis',
    intendedSubject: 'Mitoz bosqichlari',
    visualTraits: ['translucent rim-lit membrane', 'beaded volumetric violet chromosomes', 'golden spindle fibres and asters', 'cytoplasm inclusions', 'dumbbell telophase'],
  },
  {
    referenceFile: '8-40-refleks-yoyi.webp',
    bookId: 'grade8',
    topicKeys: ['grade8-40', 'grade8-45'],
    scene: 'reflexArc',
    intendedSubject: 'Refleks yoyi bo‘ylab impuls',
    visualTraits: ['layered skin block with receptor', 'glowing yellow sensory fibre', 'spinal cord segment', 'violet interneuron', 'red motor fibre', 'striated effector muscle'],
  },
  {
    referenceFile: '10-2-13-meyoz.webp',
    bookId: 'grade10',
    topicKeys: ['grade10-2-13'],
    scene: 'division',
    mode: 'meiosis',
    intendedSubject: 'Meyoz I va meyoz II',
    visualTraits: ['red/blue homologous chromosomes', 'crossing-over exchange', 'golden spindle', 'two then four cells'],
  },
  {
    referenceFile: '10-2-11-ribosoma.webp',
    bookId: 'grade10',
    topicKeys: ['grade10-2-11'],
    scene: 'translation',
    intendedSubject: 'Ribosomada translyatsiya',
    visualTraits: ['blobby blue large subunit', 'orange small subunit', 'ladder iRNK with coloured bases', 'clustered tRNAs', 'bead polypeptide'],
  },
  {
    referenceFile: '10-2-10-dnk.webp',
    bookId: 'grade10',
    topicKeys: ['grade10-2-10'],
    scene: 'dna',
    intendedSubject: 'DNK: reduplikatsiya va transkripsiya',
    visualTraits: ['atom-bead backbones', 'coloured base rungs', 'polymerase blob at the fork', 'emerging iRNK strand'],
  },
  {
    referenceFile: '10-2-8-energiya-oqimi.webp',
    bookId: 'grade10',
    topicKeys: ['grade10-2-8'],
    scene: 'metabolism',
    intendedSubject: 'Hujayrada energiya oqimi',
    visualTraits: ['translucent cell', 'violet nucleus', 'orange mitochondria with cristae (section)', 'ball-and-stick glucose', 'golden ATP glow', 'flow particles'],
  },
  {
    referenceFile: '8-42-bosh-miya.webp',
    bookId: 'grade8',
    topicKeys: ['grade8-42', 'grade8-43', 'grade8-47', 'grade8-48', 'grade8-49', 'grade8-50'],
    scene: 'brain',
    intendedSubject: 'Bosh miya (yon ko‘rinish)',
    visualTraits: ['colour-segmented lobes: coral frontal, blue parietal, green occipital, golden temporal', 'striated cerebellum', 'brainstem with spinal continuation', 'sagittal cut view', 'deep gyri'],
  },
  {
    referenceFile: '10-2-15-mitoz-meyoz.webp',
    bookId: 'grade10',
    topicKeys: ['grade10-2-15'],
    scene: 'division',
    mode: 'compare',
    intendedSubject: 'Mitoz va meyoz — sinxron taqqoslash',
    visualTraits: ['split MITOZ / MEYOZ', 'synchronized stage selector', 'differences panel'],
  },
];
