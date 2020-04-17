export interface IResource {
    name: string
    type: string
    depends_on: string[]
    allowed_in: string[]
    allowed_out: string[]
    provider: string
    location: string
}

export interface IVMSpec extends IResource {
    cores: number
    isPrivate: boolean
    os: string
    ram: number
    vpc: string
    optimisation: string
    gpus: IGPU[]
    disks: IDisk[]
}

interface IGPU {
    isOsDrive: boolean
    storage: number
}

interface IDisk {
    amount: number
    vram: number
}