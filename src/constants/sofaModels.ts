/** Tipos/modelos de sofá suportados no cadastro e filtros */
export const SOFA_MODEL_TYPES = [
  'Sofá fixo',
  'Sofá retrátil',
  'Sofá reclinável',
  'Sofá retrátil e reclinável',
  'Sofá-cama',
  'Sofá de canto',
  'Sofá modular',
  'Sofá com chaise',
  'Sofá 2 lugares',
  'Sofá 3 lugares',
  'Sofá 4 lugares ou mais',
] as const

export type SofaModelType = (typeof SOFA_MODEL_TYPES)[number]
