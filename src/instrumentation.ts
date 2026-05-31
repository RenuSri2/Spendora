export async function register() {
  if (typeof File === 'undefined') {
    const { Blob } = await import('buffer')
    // @ts-ignore
    global.File = class File extends Blob {
      name: string
      lastModified: number
      constructor(chunks: BlobPart[], filename: string, options?: FilePropertyBag) {
        super(chunks, options)
        this.name = filename
        this.lastModified = options?.lastModified ?? Date.now()
      }
    }
  }
}
