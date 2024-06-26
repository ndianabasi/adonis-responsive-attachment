/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi[at]gotedo[dot]com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ColumnOptions } from '@adonisjs/lucid'
import type { LoggerService } from '@adonisjs/core/types'
import type { MultipartFile } from '@adonisjs/bodyparser'
import type {
  DisksList,
  ContentHeaders,
  DriverContract,
  DriveManagerContract,
} from '@ioc:Adonis/Core/Drive'

export type Breakpoints = Partial<{
  large: number | 'off'
  medium: number | 'off'
  small: number | 'off'
}> &
  Record<string, number | 'off'>

/**
 * Options used to persist the attachment to
 * the disk
 */
export type AttachmentOptions = {
  disk?: keyof DisksList
  folder?: string
  keepOriginal?: boolean
  breakpoints?: Breakpoints
  forceFormat?: 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'
  optimizeSize?: boolean
  optimizeOrientation?: boolean
  responsiveDimensions?: boolean
  disableThumbnail?: boolean
  preComputeUrls?:
    | boolean
    | ((disk: DriverContract, attachment: ResponsiveAttachmentContract) => Promise<UrlRecords>)
  blurhash?: BlurhashOptions
}

export type BlurhashOptions = {
  enabled: boolean
  componentX?: number
  componentY?: number
}

export interface ImageAttributes {
  /**
   * The name is available only when "isPersisted" is true.
   */
  name?: string

  /**
   * The url is available only when "isPersisted" is true.
   */
  url?: string

  /**
   * The file size in bytes
   */
  size?: number

  /**
   * The file extname. Inferred from the BodyParser file extname
   * property
   */
  extname?: string

  /**
   * The file mimetype.
   */
  mimeType?: string

  /**
   * The hash string of the image
   * @deprecated Will be removed in later versions
   */
  hash?: string

  /**
   * The width of the image
   */
  width?: number

  /**
   * The height of the image
   */
  height?: number

  /**
   * The blurhash of the image
   */
  blurhash?: string

  /**
   * The format of the image
   */
  format?: AttachmentOptions['forceFormat']

  /**
   * The breakpoints object for the image
   */
  breakpoints?: Record<keyof ImageBreakpoints, ImageInfo>
}

/**
 * Attachment class represents an attachment data type
 * for Lucid models
 */
export interface ResponsiveAttachmentContract extends ImageAttributes {
  /**
   * The breakpoint objects
   */
  breakpoints?: Record<keyof ImageBreakpoints, ImageInfo>

  /**
   * The URLs object
   */
  urls?: UrlRecords | null

  /**
   * "isLocal = true" means the instance is created locally
   * using the bodyparser file object
   */
  isLocal: boolean

  /**
   * Find if the file has been persisted or not.
   */
  isPersisted: boolean

  /**
   * Find if the file has been deleted or not
   */
  isDeleted: boolean

  /**
   * Define persistance options
   */
  setOptions(options?: AttachmentOptions): this

  /**
   * Save responsive images to the disk. Results if noop when "this.isLocal = false"
   */
  save(): Promise<any>

  /**
   * Delete the responsive images from the disk
   */
  delete(): Promise<void>

  /**
   * Computes the URLs for the responsive images.
   * @param options
   * @param options.forced Force the URLs to be completed whether
   * `preComputedURLs` is true or not
   */
  computeUrls(
    signedUrlOptions?: ContentHeaders & { expiresIn?: string | number }
  ): Promise<UrlRecords | undefined>

  /**
   * Returns the signed or unsigned URL for each responsive image
   */
  getUrls(
    signingOptions?: ContentHeaders & { expiresIn?: string | number }
  ): Promise<UrlRecords | undefined>

  /**
   * Attachment attributes
   * Convert attachment to plain object to be persisted inside
   * the database
   */
  toObject(): AttachmentAttributes

  /**
   * Attachment attributes + url
   * Convert attachment to JSON object to be sent over
   * the wire
   */
  toJSON(): (AttachmentAttributes & (UrlRecords | null)) | null
}

/**
 * File attachment decorator
 */
export type ResponsiveAttachmentDecorator = (
  options?: AttachmentOptions & Partial<ColumnOptions>
) => <TKey extends string, TTarget extends { [K in TKey]?: ResponsiveAttachmentContract | null }>(
  target: TTarget,
  property: TKey
) => void

/**
 * Attachment class constructor
 */
export interface AttachmentConstructorContract {
  new (attributes: ImageAttributes, file?: MultipartFile): ResponsiveAttachmentContract
  fromFile(file: MultipartFile, fileName?: string): Promise<ResponsiveAttachmentContract>
  fromDbResponse(response: string): ResponsiveAttachmentContract
  fromBuffer(buffer: Buffer, fileName?: string): Promise<ResponsiveAttachmentContract>
  getDrive(): DriveManagerContract
  setDrive(drive: DriveManagerContract): void
  setLogger(logger: LoggerService): void
  getLogger(): LoggerService
}
