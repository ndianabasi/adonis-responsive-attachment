import sharp from 'sharp'
import {
  AttachmentOptions,
  ImageBreakpoints,
  ImageInfo,
  OptimizedOutput,
  BreakpointFormat,
  FileDimensions,
  BlurhashOptions,
} from '@ioc:Adonis/Addons/ResponsiveAttachment'
import { cuid } from '@poppinss/utils/build/helpers'
import { merge, pickBy, isEmpty } from 'lodash'
import { DEFAULT_BREAKPOINTS } from '../Attachment/decorator'
import { encode } from 'blurhash'

const getMergedOptions = function (options: AttachmentOptions): AttachmentOptions {
  return merge(
    {
      preComputeUrls: false,
      breakpoints: DEFAULT_BREAKPOINTS,
      forceFormat: undefined,
      optimizeOrientation: true,
      optimizeSize: true,
      responsiveDimensions: true,
      disableThumbnail: false,
      blurhash: getDefaultBlurhashOptions(options),
    },
    options
  )
}

export const bytesToKBytes = (bytes: number) => Math.round((bytes / 1000) * 100) / 100

export const getMetaData = async (buffer: Buffer) =>
  await sharp(buffer, { failOnError: false }).metadata()

export const getDimensions = async function (buffer: Buffer): Promise<FileDimensions> {
  return await getMetaData(buffer).then(({ width, height }) => ({ width, height }))
}

/**
 * Default thumbnail resize options
 */
export const THUMBNAIL_RESIZE_OPTIONS = {
  width: 245,
  height: 156,
  fit: 'inside' as sharp.FitEnum['inside'],
}

export const resizeTo = async function (
  buffer: Buffer,
  options: AttachmentOptions,
  resizeOptions: sharp.ResizeOptions
) {
  const sharpInstance = options?.forceFormat
    ? sharp(buffer, { failOnError: false }).toFormat(options.forceFormat)
    : sharp(buffer, { failOnError: false })

  return await sharpInstance
    .withMetadata()
    .resize(resizeOptions)
    .toBuffer()
    .catch(() => null)
}

export const breakpointSmallerThan = (breakpoint: number, { width, height }: FileDimensions) =>
  breakpoint < width! || breakpoint < height!

export const allowedFormats: Array<AttachmentOptions['forceFormat']> = [
  'jpeg',
  'png',
  'webp',
  'avif',
  'tiff',
]

export const canBeProcessed = async (buffer: Buffer) => {
  const { format } = await getMetaData(buffer)
  return format && allowedFormats.includes(format as AttachmentOptions['forceFormat'])
}

const getImageExtension = function (imageFormat: ImageInfo['format']) {
  return imageFormat === 'jpeg' ? 'jpg' : imageFormat!
}

export const generateBreakpoint = async ({
  key,
  imageData,
  breakpoint,
  options,
}: {
  key: keyof ImageBreakpoints | string
  imageData: ImageInfo
  breakpoint: number
  options: AttachmentOptions
}): Promise<BreakpointFormat> => {
  const breakpointBuffer = await resizeTo(imageData.buffer!, options, {
    width: breakpoint,
    height: breakpoint,
    fit: 'inside',
  })

  if (breakpointBuffer) {
    const { width, height, size, format } = await getMetaData(breakpointBuffer)

    const extname = getImageExtension(format as ImageInfo['format'])
    const breakpointFileName = generateName({
      extname,
      hash: imageData.hash,
      options,
      prefix: key as keyof ImageBreakpoints,
      fileName: imageData.fileName,
    })

    return {
      key: key as keyof ImageBreakpoints,
      file: {
        // Override attributes in `imageData`
        name: breakpointFileName,
        hash: imageData.hash,
        extname,
        mimeType: `image/${format}`,
        format: format as AttachmentOptions['forceFormat'],
        width: width,
        height: height,
        size: bytesToKBytes(size!),
        buffer: breakpointBuffer,
        blurhash: imageData.blurhash,
      },
    }
  } else {
    return null
  }
}

/**
 * Generates the name for the attachment and prefixes
 * the folder (if defined)
 * @param payload
 * @param payload.extname The extension name for the image
 * @param payload.hash Hash string to use instead of a CUID
 * @param payload.prefix String to prepend to the filename
 * @param payload.options Attachment options
 */
export const generateName = function ({
  extname,
  fileName,
  hash,
  prefix,
  options,
}: {
  extname?: string
  fileName?: string
  hash?: string
  prefix?: keyof ImageBreakpoints | 'original'
  options?: AttachmentOptions
}): string {
  return `${options?.folder ? `${options.folder}/` : ''}${prefix ? `${prefix}_` : ''}${
    fileName ? `${fileName}_` : ''
  }${hash ? hash : cuid()}.${extname}`
}

export const optimize = async function (
  buffer: Buffer,
  options?: AttachmentOptions
): Promise<OptimizedOutput> {
  const { optimizeOrientation, optimizeSize, forceFormat } = options || {}

  // Check if the image is in the right format or can be size optimised
  if (!optimizeSize || !(await canBeProcessed(buffer))) {
    return { buffer }
  }

  // Auto rotate the image if `optimizeOrientation` is true
  let sharpInstance = optimizeOrientation
    ? sharp(buffer, { failOnError: false }).rotate()
    : sharp(buffer, { failOnError: false })

  // Force image to output to a specific format if `forceFormat` is true
  sharpInstance = forceFormat ? sharpInstance.toFormat(forceFormat) : sharpInstance

  return await sharpInstance
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      // The original buffer should not be smaller than the optimised buffer
      const outputBuffer = buffer.length < data.length ? buffer : data

      return {
        buffer: outputBuffer,
        info: {
          width: info.width,
          height: info.height,
          size: bytesToKBytes(outputBuffer.length),
          format: info.format as AttachmentOptions['forceFormat'],
          mimeType: `image/${info.format}`,
          extname: getImageExtension(info.format as ImageInfo['format']),
        },
      }
    })
    .catch(() => ({ buffer }))
}

export const generateThumbnail = async function (
  imageData: ImageInfo,
  options: AttachmentOptions
): Promise<ImageInfo | null> {
  options = getMergedOptions(options)
  const blurhashEnabled = !!options.blurhash?.enabled
  let blurhash: string | undefined

  if (!(await canBeProcessed(imageData.buffer!))) {
    return null
  }

  if (!blurhashEnabled && (!options?.responsiveDimensions || options?.disableThumbnail)) {
    return null
  }

  const { width, height } = await getDimensions(imageData.buffer!)

  if (!width || !height) return null

  if (width > THUMBNAIL_RESIZE_OPTIONS.width || height > THUMBNAIL_RESIZE_OPTIONS.height) {
    const thumbnailBuffer = await resizeTo(imageData.buffer!, options, THUMBNAIL_RESIZE_OPTIONS)

    if (thumbnailBuffer) {
      const {
        width: thumbnailWidth,
        height: thumbnailHeight,
        size,
        format,
      } = await getMetaData(thumbnailBuffer)

      const extname = getImageExtension(format as ImageInfo['format'])

      const thumbnailFileName = generateName({
        extname,
        hash: imageData.hash,
        options,
        prefix: 'thumbnail',
        fileName: imageData.fileName,
      })

      const thumbnailImageData: ImageInfo = {
        name: thumbnailFileName,
        hash: imageData.hash,
        extname,
        mimeType: `image/${format}`,
        format: format as AttachmentOptions['forceFormat'],
        width: thumbnailWidth,
        height: thumbnailHeight,
        size: bytesToKBytes(size!),
        buffer: thumbnailBuffer,
      }

      // Generate blurhash
      if (blurhashEnabled) {
        blurhash = await encodeImageToBlurhash(options, thumbnailImageData.buffer)
        // Set the blurhash in the thumbnail data
        thumbnailImageData.blurhash = blurhash
      }

      return thumbnailImageData
    }
  }

  return null
}

export const generateBreakpointImages = async function (
  imageData: ImageInfo,
  options: AttachmentOptions
) {
  options = getMergedOptions(options)
  /**
   * Noop if `responsiveDimensions` is falsy
   */
  if (!options.responsiveDimensions) return []

  /**
   * Noop if image format is not allowed
   */
  if (!(await canBeProcessed(imageData.buffer!))) {
    return []
  }

  const originalDimensions: FileDimensions = await getDimensions(imageData.buffer!)

  const activeBreakpoints = pickBy(options.breakpoints, (value) => {
    return value !== 'off'
  })

  if (isEmpty(activeBreakpoints)) return []

  return Promise.all(
    Object.keys(activeBreakpoints).map((key) => {
      const breakpointValue = options.breakpoints?.[key] as number

      const isBreakpointSmallerThanOriginal = breakpointSmallerThan(
        breakpointValue,
        originalDimensions
      )

      if (isBreakpointSmallerThanOriginal) {
        return generateBreakpoint({ key, imageData, breakpoint: breakpointValue, options })
      }
    })
  )
}

export function getDefaultBlurhashOptions(
  options: AttachmentOptions | undefined
): Required<BlurhashOptions> {
  return {
    enabled: options?.blurhash?.enabled ?? false,
    componentX: options?.blurhash?.componentX ?? 4,
    componentY: options?.blurhash?.componentY ?? 3,
  }
}

export function encodeImageToBlurhash(
  options: AttachmentOptions,
  imageBuffer?: Buffer
): Promise<string> {
  const { blurhash } = options
  const { componentX, componentY } = blurhash || {}

  if (!componentX || !componentY) {
    throw new Error('Ensure "componentX" and "componentY" are set')
  }
  if (!imageBuffer) {
    throw new Error('Ensure "buffer" is provided')
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Convert buffer to pixels
      const { data: pixels, info: metadata } = await sharp(imageBuffer)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true })

      return resolve(
        encode(
          new Uint8ClampedArray(pixels),
          metadata.width,
          metadata.height,
          componentX,
          componentY
        )
      )
    } catch (error) {
      return reject(error)
    }
  })
}
