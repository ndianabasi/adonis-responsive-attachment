/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi@furnish.ng>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import detect from 'detect-file-type'
import { readFile } from 'fs/promises'
import { DEFAULT_BREAKPOINTS } from './decorator'
import { cuid } from '@poppinss/utils/build/helpers'
import { merge, isEmpty, assign, set } from 'lodash'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import type { MultipartFileContract } from '@ioc:Adonis/Core/BodyParser'
import { DriveManagerContract, ContentHeaders, Visibility } from '@ioc:Adonis/Core/Drive'
import {
  allowedFormats,
  generateBreakpointImages,
  generateName,
  generateThumbnail,
  getDefaultBlurhashOptions,
  getDimensions,
  getMergedOptions,
  optimize,
} from '../Helpers/image_manipulation_helper'
import type {
  AttachmentOptions,
  ResponsiveAttachmentContract,
  AttachmentAttributes,
  AttachmentConstructorContract,
  ImageInfo,
  UrlRecords,
  ImageBreakpoints,
  ImageAttributes,
} from '@ioc:Adonis/Addons/ResponsiveAttachment'

export const tempUploadFolder = 'image_upload_tmp'

/**
 * Attachment class represents an attachment data type
 * for Lucid models
 */
export class ResponsiveAttachment implements ResponsiveAttachmentContract {
  private static drive: DriveManagerContract
  private static logger: LoggerContract

  /**
   * Reference to the drive
   */
  public static getDrive() {
    return this.drive
  }

  /**
   * Set the drive instance
   */
  public static setDrive(drive: DriveManagerContract) {
    this.drive = drive
  }

  /**
   * Set the logger instance
   */
  public static setLogger(logger: LoggerContract) {
    this.logger = logger
  }

  /**
   * Reference to the logger instance
   */
  public static getLogger() {
    return this.logger
  }

  /**
   * Create attachment instance from the bodyparser
   * file
   */
  public static async fromFile(file: MultipartFileContract, fileName?: string) {
    if (!file) {
      throw new SyntaxError('You should provide a non-falsy value')
    }

    if (allowedFormats.includes(file?.subtype as AttachmentOptions['forceFormat']) === false) {
      throw new RangeError(
        `Uploaded file is not an allowable image. Make sure that you uploaded only the following format: "jpeg", "png", "webp", "tiff", and "avif".`
      )
    }

    if (!file.tmpPath) {
      throw new Error('Please provide a valid file')
    }

    // Get the file buffer
    const buffer = await readFile(file.tmpPath)

    const computedFileName = fileName ? fileName : file.fieldName

    const attributes = {
      extname: file.extname!,
      mimeType: `${file.type}/${file.subtype}`,
      size: file.size,
      fileName: computedFileName.replace(/[^\d\w]+/g, '_').toLowerCase(),
    }

    return new ResponsiveAttachment(attributes, buffer) as ResponsiveAttachmentContract
  }

  /**
   * Create attachment instance from the bodyparser via a buffer
   */
  public static fromBuffer(buffer: Buffer, name?: string): Promise<ResponsiveAttachmentContract> {
    return new Promise((resolve, reject) => {
      try {
        type BufferProperty = { ext: string; mime: string }

        let bufferProperty: BufferProperty | undefined

        detect.fromBuffer(buffer, function (err: Error | string, result: BufferProperty) {
          if (err) {
            throw new Error(err instanceof Error ? err.message : err)
          }
          if (!result) {
            throw new Error('Please provide a valid file buffer')
          }
          bufferProperty = result
        })

        const { mime, ext } = bufferProperty!
        const subtype = mime.split('/').pop()

        if (allowedFormats.includes(subtype as AttachmentOptions['forceFormat']) === false) {
          throw new RangeError(
            `Uploaded file is not an allowable image. Make sure that you uploaded only the following format: "jpeg", "png", "webp", "tiff", and "avif".`
          )
        }

        const attributes = {
          extname: ext,
          mimeType: mime,
          size: buffer.length,
          fileName: name?.replace(/[^\d\w]+/g, '_')?.toLowerCase() ?? '',
        }

        return resolve(new ResponsiveAttachment(attributes, buffer) as ResponsiveAttachmentContract)
      } catch (error) {
        return reject(error)
      }
    })
  }

  /**
   * Create attachment instance from the database response
   */
  public static fromDbResponse(response: string | ImageAttributes) {
    let attributes: ImageAttributes | null = null

    if (typeof response === 'string') {
      try {
        attributes = JSON.parse(response) as ImageAttributes
      } catch (error) {
        ResponsiveAttachment.logger.warn('Incompatible image data skipped: %s', response)
        attributes = null
      }
    } else {
      attributes = response as ImageAttributes
    }

    if (!attributes) return null

    const attachment = new ResponsiveAttachment(attributes)

    /**
     * Images fetched from DB are always persisted
     */
    attachment.isPersisted = true
    return attachment
  }

  /**
   * Attachment options
   */
  public options?: AttachmentOptions

  /**
   * The generated name of the original file.
   * Available only when "isPersisted" is true.
   */
  public name?: string

  /**
   * The generated url of the original file.
   * Available only when "isPersisted" is true.
   */
  public url?: string

  /**
   * The urls of the original and breakpoint files.
   * Available only when "isPersisted" is true.
   */
  public urls?: UrlRecords

  /**
   * The image size of the original file in bytes
   */
  public size?: number

  /**
   * The image extname. Inferred from the bodyparser file extname
   * property
   */
  public extname?: string

  /**
   * The image mimetype.
   */
  public mimeType?: string

  /**
   * The image hash.
   * @deprecated Will be removed in later versions
   */
  public hash?: string

  /**
   * The image width.
   */
  public width?: number

  /**
   * The image height.
   */
  public height?: number

  /**
   * The image's blurhash.
   */
  public blurhash?: string

  /**
   * This file name.
   */
  public fileName?: string

  /**
   * The format or filetype of the image.
   */
  public format?: AttachmentOptions['forceFormat']

  /**
   * The format or filetype of the image.
   */
  public breakpoints?: Record<keyof ImageBreakpoints, ImageInfo>

  /**
   * Find if the image has been persisted or not.
   */
  public isPersisted = false

  /**
   * Find if the image has been deleted or not
   */
  public isDeleted: boolean

  constructor(attributes: AttachmentAttributes & { fileName?: string }, private buffer?: Buffer) {
    this.name = attributes.name
    this.size = attributes.size
    this.hash = attributes.hash
    this.width = attributes.width
    this.format = attributes.format
    this.blurhash = attributes.blurhash
    this.height = attributes.height
    this.extname = attributes.extname
    this.mimeType = attributes.mimeType
    this.url = attributes.url ?? undefined
    this.breakpoints = attributes.breakpoints ?? undefined
    this.fileName = attributes.fileName ?? ''
    this.isLocal = !!this.buffer
  }

  public get attributes() {
    return {
      name: this.name,
      size: this.size,
      hash: this.hash,
      width: this.width,
      format: this.format,
      height: this.height,
      extname: this.extname,
      mimeType: this.mimeType,
      url: this.url,
      breakpoints: this.breakpoints,
      buffer: this.buffer,
      blurhash: this.blurhash,
    }
  }

  /**
   * "isLocal = true" means the instance is created locally
   * using the bodyparser file object
   */
  public isLocal = !!this.buffer

  /**
   * Returns disk instance
   */
  private getDisk() {
    const disk = this.options?.disk
    const drive = (this.constructor as AttachmentConstructorContract).getDrive()
    return disk ? drive.use(disk) : drive.use()
  }

  /**
   * Returns disk instance
   */
  private get loggerInstance() {
    return (this.constructor as AttachmentConstructorContract).getLogger()
  }

  /**
   * Define persistance options
   */
  public setOptions(options?: AttachmentOptions) {
    this.options = merge(
      {
        preComputeUrls: this.options?.preComputeUrls ?? true,
        keepOriginal: this.options?.keepOriginal ?? true,
        breakpoints: this.options?.breakpoints ?? DEFAULT_BREAKPOINTS,
        forceFormat: this.options?.forceFormat,
        optimizeOrientation: this.options?.optimizeOrientation ?? true,
        optimizeSize: this.options?.optimizeSize ?? true,
        responsiveDimensions: this.options?.responsiveDimensions ?? true,
        disableThumbnail: this.options?.disableThumbnail ?? false,
        folder: this.options?.folder,
        disk: this.options?.disk,
        blurhash: getDefaultBlurhashOptions(this.options),
      },
      options
    )

    return this
  }

  protected async enhanceFile(): Promise<ImageInfo> {
    // Optimise the image buffer and return the optimised buffer
    // and the info of the image
    const { buffer, info } = await optimize(this.buffer!, this.options)

    // Override the `imageInfo` object with the optimised `info` object
    // As the optimised `info` object is preferred
    // Also append the `hash` and `buffer`
    return assign({ ...this.attributes }, info, { hash: cuid(), buffer })
  }

  /**
   * Save image to the disk. Results in noop when "this.isLocal = false"
   */
  public async save() {
    const OPTIONS = getMergedOptions(this.options || {})

    try {
      /**
       * Do not persist already persisted image or if the
       * instance is not local
       */
      if (!this.isLocal || this.isPersisted) {
        return this
      }

      /**
       * Optimise the original file and return the enhanced buffer and
       * information of the enhanced buffer
       */
      const enhancedImageData = await this.enhanceFile()

      /**
       * Generate the name of the original image
       */
      this.name = OPTIONS.keepOriginal
        ? generateName({
            extname: enhancedImageData.extname,
            hash: enhancedImageData.hash,
            options: OPTIONS,
            prefix: 'original',
            fileName: this.fileName,
          })
        : undefined

      /**
       * Update the local attributes with the attributes
       * of the optimised original file
       */
      if (OPTIONS.keepOriginal) {
        this.size = enhancedImageData.size
        this.hash = enhancedImageData.hash
        this.width = enhancedImageData.width
        this.height = enhancedImageData.height
        this.format = enhancedImageData.format
        this.extname = enhancedImageData.extname
        this.mimeType = enhancedImageData.mimeType
      }

      /**
       * Inject the name into the `ImageInfo`
       */
      enhancedImageData.name = this.name
      enhancedImageData.fileName = this.fileName

      /**
       * Write the optimised original image to the disk
       */
      if (OPTIONS.keepOriginal) {
        await this.getDisk().put(enhancedImageData.name!, enhancedImageData.buffer!)
      }

      /**
       * Generate image thumbnail data
       */
      const thumbnailImageData = await generateThumbnail(enhancedImageData, OPTIONS)

      if (thumbnailImageData) {
        // Set blurhash to top-level image data
        this.blurhash = thumbnailImageData.blurhash
        // Set the blurhash to the enhanced image data
        enhancedImageData.blurhash = thumbnailImageData.blurhash
      }

      const thumbnailIsRequired = OPTIONS.responsiveDimensions && !OPTIONS.disableThumbnail

      if (thumbnailImageData && thumbnailIsRequired) {
        /**
         * Write the thumbnail image to the disk
         */
        await this.getDisk().put(thumbnailImageData.name!, thumbnailImageData.buffer!)
        /**
         * Delete buffer from `thumbnailImageData`
         */
        delete thumbnailImageData.buffer

        set(enhancedImageData, 'breakpoints.thumbnail', thumbnailImageData)
      }

      /**
       * Generate breakpoint image data
       */
      const breakpointFormats = await generateBreakpointImages(enhancedImageData, OPTIONS)
      if (breakpointFormats && Array.isArray(breakpointFormats) && breakpointFormats.length > 0) {
        for (const format of breakpointFormats) {
          if (!format) continue

          const { key, file: breakpointImageData } = format

          /**
           * Write the breakpoint image to the disk
           */
          await this.getDisk().put(breakpointImageData.name!, breakpointImageData.buffer!)

          /**
           * Delete buffer from `breakpointImageData`
           */
          delete breakpointImageData.buffer

          set(enhancedImageData, ['breakpoints', key], breakpointImageData)
        }
      }

      const { width, height } = await getDimensions(enhancedImageData.buffer!)

      delete enhancedImageData.buffer

      assign(enhancedImageData, {
        width,
        height,
      })

      /**
       * Update the width and height
       */
      if (OPTIONS.keepOriginal) {
        this.width = enhancedImageData.width
        this.height = enhancedImageData.height
      }

      /**
       * Update the local value of `breakpoints`
       */
      this.breakpoints = enhancedImageData.breakpoints!

      /**
       * Images has been persisted
       */
      this.isPersisted = true

      /**
       * Delete the temporary file
       */
      if (this.buffer) {
        this.buffer = undefined
      }

      /**
       * Compute the URL
       */
      await this.computeUrls().catch((error) => {
        this.loggerInstance.error('Adonis Responsive Attachment error: %o', error)
      })

      return this
    } catch (error) {
      this.loggerInstance.fatal('Adonis Responsive Attachment error', error)
      throw error
    }
  }

  /**
   * Delete original and responsive images from the disk
   */
  public async delete() {
    const OPTIONS = getMergedOptions(this.options || {})

    try {
      if (!this.isPersisted) {
        return
      }

      /**
       * Delete the original image
       */
      if (OPTIONS.keepOriginal) await this.getDisk().delete(this.name!)
      /**
       * Delete the responsive images
       */
      if (this.breakpoints) {
        for (const key in this.breakpoints) {
          if (Object.prototype.hasOwnProperty.call(this.breakpoints, key)) {
            const breakpointImage = this.breakpoints[key] as ImageAttributes
            await this.getDisk().delete(breakpointImage.name!)
          }
        }
      }

      this.isDeleted = true
      this.isPersisted = false
    } catch (error) {
      this.loggerInstance.fatal('Adonis Responsive Attachment error', error)
      throw error
    }
  }

  public async computeUrls(signedUrlOptions?: ContentHeaders & { expiresIn?: string | number }) {
    /**
     * Cannot compute url for a non persisted image
     */
    if (!this.isPersisted) {
      return
    }

    /**
     * Compute urls when preComputeUrls is set to true
     * or the `preComputeUrls` function exists
     */
    if (!this.options?.preComputeUrls && this.isLocal) {
      return
    }

    const disk = this.getDisk()

    /**
     * Generate url using the user defined preComputeUrls method
     */
    if (typeof this.options?.preComputeUrls === 'function') {
      const urls = await this.options.preComputeUrls(disk, this).catch((error) => {
        this.loggerInstance.error('Adonis Responsive Attachment error: %o', error)
        return null
      })

      if (urls) {
        this.url = urls.url
        if (!this.urls) this.urls = {} as UrlRecords
        if (!this.urls.breakpoints) this.urls.breakpoints = {} as ImageBreakpoints
        for (const key in urls.breakpoints) {
          if (Object.prototype.hasOwnProperty.call(urls.breakpoints, key)) {
            if (!this.urls.breakpoints[key]) this.urls.breakpoints[key] = { url: '' }
            this.urls.breakpoints[key].url = urls.breakpoints[key].url
          }
        }
        return this.urls
      }
    }

    /**
     * Iterative URL-computation logic
     */
    const { buffer, ...originalAttributes } = this.attributes
    const attachmentData = originalAttributes
    if (attachmentData) {
      if (!this.urls) this.urls = {} as UrlRecords

      for (const key in attachmentData) {
        if (['name', 'breakpoints'].includes(key) === false) {
          continue
        }

        const value: string | ImageBreakpoints = attachmentData[key]
        let url: string

        if (key === 'name') {
          if ((this.options?.keepOriginal ?? true) === false || !this.name) {
            continue
          }

          const name = value as string

          let imageVisibility: Visibility
          try {
            imageVisibility = await disk.getVisibility(name)
          } catch (error) {
            this.loggerInstance.error('Adonis Responsive Attachment error: %s', error)
            continue
          }

          if (imageVisibility === 'private') {
            url = await disk.getSignedUrl(name, signedUrlOptions || undefined)
          } else {
            url = await disk.getUrl(name)
          }

          this.urls['url'] = url
          this.url = url
        }

        if (key === 'breakpoints') {
          if (isEmpty(value) === false) {
            if (!this.urls.breakpoints) {
              this.urls.breakpoints = {} as ImageBreakpoints
            }

            const breakpoints = value as ImageBreakpoints

            for (const breakpoint in breakpoints) {
              if (Object.prototype.hasOwnProperty.call(breakpoints, breakpoint)) {
                const breakpointImageData: Exclude<ImageInfo, 'breakpoints'> =
                  breakpoints?.[breakpoint]

                if (breakpointImageData) {
                  const imageVisibility = await disk.getVisibility(breakpointImageData.name!)
                  if (imageVisibility === 'private') {
                    url = await disk.getSignedUrl(
                      breakpointImageData.name!,
                      signedUrlOptions || undefined
                    )
                  } else {
                    url = await disk.getUrl(breakpointImageData.name!)
                  }
                  this.urls['breakpoints'][breakpoint] = { url }
                }
              }
            }
          }
        }
      }
    }

    return this.urls
  }

  /**
   * Returns the signed or unsigned URL for each responsive image
   */
  public async getUrls(signingOptions?: ContentHeaders & { expiresIn?: string | number }) {
    return this.computeUrls({ ...signingOptions }).catch((error) => {
      this.loggerInstance.error('Adonis Responsive Attachment error: %o', error)
      return undefined
    })
  }

  /**
   * Convert attachment instance to object without the `url` property
   * for persistence to the database
   */
  public toObject() {
    const { buffer, url, ...originalAttributes } = this.attributes

    return merge(this.options?.keepOriginal ?? true ? originalAttributes : {}, {
      breakpoints: this.breakpoints,
    })
  }

  /**
   * Serialize attachment instance to JSON object to be sent over the wire
   */
  public toJSON() {
    return merge(this.toObject(), this.urls ?? {})
  }
}
