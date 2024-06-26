/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi[at]gotedo[dot]com>
 *
 * For the full copyright and license information,
 * please view the LICENSE file that was distributed with
 * this source code.
 */

import { readFile } from 'fs/promises'
import { Exception } from '@poppinss/utils'
import type { Logger } from '@adonisjs/logger'
import { ValidationRuntimeOptions, validator as validatorStatic } from '@ioc:Adonis/Core/Validator'
import { getMetaData } from '../services/image_manipulation_service'
import type { MultipartFile } from '@adonisjs/bodyparser'

type NormalizedOptions = { validationValue: number }

enum ImageDimensionsValidationRule {
  maxImageWidth = 'maxImageWidth',
  maxImageHeight = 'maxImageHeight',
  minImageWidth = 'minImageWidth',
  minImageHeight = 'minImageHeight',
  imageAspectRatio = 'imageAspectRatio',
}

/**
 * Ensure image is complaint with expected dimensions validations
 */
class ImageDimensionsCheck {
  constructor(
    public ruleName: ImageDimensionsValidationRule,
    protected logger: Logger
  ) {}

  /**
   * Compile validation options
   */
  public compile(validationValue: number) {
    /**
     * Ensure options are defined with table and column name
     */
    if (!validationValue) {
      throw new Exception(`"${this.ruleName}" rule expects a "validationValue"`)
    }

    return {
      validationValue,
    }
  }

  /**
   * Validate the file
   */
  public async validate(
    file: MultipartFile,
    { validationValue }: NormalizedOptions,
    { pointer, errorReporter, arrayExpressionPointer }: ValidationRuntimeOptions
  ) {
    if (!file) {
      return
    }

    if (!file.tmpPath) {
      throw new Error('File is invalid')
    }

    const imageBuffer = await readFile(file.tmpPath)
    const { width, height } = await getMetaData(imageBuffer)
    const reportError = () => {
      errorReporter.report(
        pointer,
        this.ruleName,
        `${this.ruleName} validation failure`,
        arrayExpressionPointer
      )
    }

    if (this.ruleName === 'minImageWidth') {
      if (!width || width < validationValue) {
        reportError()
      }
      return
    }

    if (this.ruleName === 'minImageHeight') {
      if (!height || height < validationValue) {
        reportError()
      }
      return
    }

    if (this.ruleName === 'maxImageWidth') {
      if (!width || width > validationValue) {
        reportError()
      }
      return
    }

    if (this.ruleName === 'maxImageHeight') {
      if (!height || height > validationValue) {
        reportError()
      }
      return
    }

    if (this.ruleName === 'imageAspectRatio') {
      if (!height || !width || width / height !== validationValue) {
        reportError()
      }
      return
    }

    throw new Error('Invalid image validation operation')
  }
}

function throwCatchallError(error: Error) {
  if (error.message === 'Invalid image validation operation') {
    throw error
  }
}

/**
 * Extends the validator by adding `unique` and `exists`
 */
export function extendValidator(validator: typeof validatorStatic, logger: Logger) {
  const minImageWidthRuleChecker = new ImageDimensionsCheck(
    ImageDimensionsValidationRule.minImageWidth,
    logger
  )

  validator.rule<ReturnType<(typeof minImageWidthRuleChecker)['compile']>>(
    minImageWidthRuleChecker.ruleName,
    async (value: MultipartFile, compiledOptions, options) => {
      try {
        await minImageWidthRuleChecker.validate(value, compiledOptions, options)
      } catch (error) {
        throwCatchallError(error)

        logger.fatal(
          { err: error },
          `"${minImageWidthRuleChecker.ruleName}" validation rule failed`
        )
        options.errorReporter.report(
          options.pointer,
          `${minImageWidthRuleChecker.ruleName}`,
          `${minImageWidthRuleChecker.ruleName} validation failure`,
          options.arrayExpressionPointer
        )
      }
    },
    (options) => {
      return {
        compiledOptions: minImageWidthRuleChecker.compile(options[0]),
        async: true,
      }
    }
  )

  const minImageHeightRuleChecker = new ImageDimensionsCheck(
    ImageDimensionsValidationRule.minImageHeight,
    logger
  )

  validator.rule<ReturnType<(typeof minImageHeightRuleChecker)['compile']>>(
    minImageHeightRuleChecker.ruleName,
    async (value: MultipartFile, compiledOptions, options) => {
      try {
        await minImageHeightRuleChecker.validate(value, compiledOptions, options)
      } catch (error) {
        throwCatchallError(error)

        logger.fatal(
          { err: error },
          `"${minImageHeightRuleChecker.ruleName}" validation rule failed`
        )
        options.errorReporter.report(
          options.pointer,
          `${minImageHeightRuleChecker.ruleName}`,
          `${minImageHeightRuleChecker.ruleName} validation failure`,
          options.arrayExpressionPointer
        )
      }
    },
    (options) => {
      return {
        compiledOptions: minImageHeightRuleChecker.compile(options[0]),
        async: true,
      }
    }
  )

  const maxImageWidthRuleChecker = new ImageDimensionsCheck(
    ImageDimensionsValidationRule.maxImageWidth,
    logger
  )

  validator.rule<ReturnType<(typeof maxImageWidthRuleChecker)['compile']>>(
    maxImageWidthRuleChecker.ruleName,
    async (value: MultipartFile, compiledOptions, options) => {
      try {
        await maxImageWidthRuleChecker.validate(value, compiledOptions, options)
      } catch (error) {
        throwCatchallError(error)

        logger.fatal(
          { err: error },
          `"${maxImageWidthRuleChecker.ruleName}" validation rule failed`
        )
        options.errorReporter.report(
          options.pointer,
          `${maxImageWidthRuleChecker.ruleName}`,
          `${maxImageWidthRuleChecker.ruleName} validation failure`,
          options.arrayExpressionPointer
        )
      }
    },
    (options) => {
      return {
        compiledOptions: maxImageWidthRuleChecker.compile(options[0]),
        async: true,
      }
    }
  )

  const maxImageHeightRuleChecker = new ImageDimensionsCheck(
    ImageDimensionsValidationRule.maxImageHeight,
    logger
  )

  validator.rule<ReturnType<(typeof maxImageHeightRuleChecker)['compile']>>(
    maxImageHeightRuleChecker.ruleName,
    async (value: MultipartFile, compiledOptions, options) => {
      try {
        await maxImageHeightRuleChecker.validate(value, compiledOptions, options)
      } catch (error) {
        throwCatchallError(error)

        logger.fatal(
          { err: error },
          `"${maxImageHeightRuleChecker.ruleName}" validation rule failed`
        )
        options.errorReporter.report(
          options.pointer,
          `${maxImageHeightRuleChecker.ruleName}`,
          `${maxImageHeightRuleChecker.ruleName} validation failure`,
          options.arrayExpressionPointer
        )
      }
    },
    (options) => {
      return {
        compiledOptions: maxImageHeightRuleChecker.compile(options[0]),
        async: true,
      }
    }
  )

  const aspectRatioRuleChecker = new ImageDimensionsCheck(
    ImageDimensionsValidationRule.imageAspectRatio,
    logger
  )

  validator.rule<ReturnType<(typeof aspectRatioRuleChecker)['compile']>>(
    aspectRatioRuleChecker.ruleName,
    async (value: MultipartFile, compiledOptions, options) => {
      try {
        await aspectRatioRuleChecker.validate(value, compiledOptions, options)
      } catch (error) {
        throwCatchallError(error)

        logger.fatal({ err: error }, `"${aspectRatioRuleChecker.ruleName}" validation rule failed`)
        options.errorReporter.report(
          options.pointer,
          `${aspectRatioRuleChecker.ruleName}`,
          `${aspectRatioRuleChecker.ruleName} validation failure`,
          options.arrayExpressionPointer
        )
      }
    },
    (options) => {
      return {
        compiledOptions: aspectRatioRuleChecker.compile(options[0]),
        async: true,
      }
    }
  )
}
