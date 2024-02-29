/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi@furnish.ng>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { readFile } from 'fs/promises'
import { Exception } from '@poppinss/utils'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import { ValidationRuntimeOptions, validator as validatorStatic } from '@ioc:Adonis/Core/Validator'
import { getMetaData } from '../Helpers/ImageManipulationHelper'
import type { MultipartFileContract } from '@ioc:Adonis/Core/BodyParser'

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
  constructor(private ruleName: ImageDimensionsValidationRule) {}

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
   * Validate value
   */
  public async validate(
    file: MultipartFileContract,
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

    if (this.ruleName === 'minImageWidth') {
      if (!width || width < validationValue) {
        errorReporter.report(
          pointer,
          this.ruleName,
          `${this.ruleName} validation failure`,
          arrayExpressionPointer
        )
      }
      return
    }

    if (this.ruleName === 'minImageHeight') {
      if (!height || height < validationValue) {
        errorReporter.report(
          pointer,
          this.ruleName,
          `${this.ruleName} validation failure`,
          arrayExpressionPointer
        )
      }
      return
    }

    throw new Error('Invalid image validation operation')
  }
}

/**
 * Extends the validator by adding `unique` and `exists`
 */
export function extendValidator(validator: typeof validatorStatic, logger: LoggerContract) {
  const minImageWidthChecker = new ImageDimensionsCheck(ImageDimensionsValidationRule.minImageWidth)

  validator.rule<ReturnType<(typeof minImageWidthChecker)['compile']>>(
    'exists',
    async (value: MultipartFileContract, compiledOptions, options) => {
      try {
        await minImageWidthChecker.validate(value, compiledOptions, options)
      } catch (error) {
        logger.fatal(
          { err: error },
          `"${ImageDimensionsValidationRule.minImageWidth}" validation rule failed`
        )
        options.errorReporter.report(
          options.pointer,
          `${ImageDimensionsValidationRule.minImageWidth}`,
          `${ImageDimensionsValidationRule.minImageWidth} validation failure`,
          options.arrayExpressionPointer
        )
      }
    },
    (options) => {
      return {
        compiledOptions: minImageWidthChecker.compile(options[0]),
        async: true,
      }
    }
  )

  const minImageHeightChecker = new ImageDimensionsCheck(
    ImageDimensionsValidationRule.minImageHeight
  )

  validator.rule<ReturnType<(typeof minImageHeightChecker)['compile']>>(
    'exists',
    async (value: MultipartFileContract, compiledOptions, options) => {
      try {
        await minImageHeightChecker.validate(value, compiledOptions, options)
      } catch (error) {
        logger.fatal(
          { err: error },
          `"${ImageDimensionsValidationRule.minImageHeight}" validation rule failed`
        )
        options.errorReporter.report(
          options.pointer,
          `${ImageDimensionsValidationRule.minImageHeight}`,
          `${ImageDimensionsValidationRule.minImageHeight} validation failure`,
          options.arrayExpressionPointer
        )
      }
    },
    (options) => {
      return {
        compiledOptions: minImageHeightChecker.compile(options[0]),
        async: true,
      }
    }
  )
}
