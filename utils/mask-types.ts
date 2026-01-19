// Face mask type definitions
export type MaskType = 'blur' | 'pixelate' | 'solid' | 'emoji'

export interface MaskOption {
  type: MaskType
  label: string
  icon: string
}

export const maskOptions: MaskOption[] = [
  { type: 'blur', label: '模糊', icon: '🌫️' },
  { type: 'pixelate', label: '馬賽克', icon: '🔲' },
  { type: 'solid', label: '色塊', icon: '🟥' },
  { type: 'emoji', label: '表情', icon: '😀' }
]

export const defaultMaskType: MaskType = 'blur'
