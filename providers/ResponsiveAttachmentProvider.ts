/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi@furnish.ng>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class ResponsiveAttachmentProvider {
  constructor(protected application: ApplicationContract) {}

  /**
   * Extends the validator by defining validation rules
   */
  private defineValidationRules() {
    /**
     * Do not register validation rules in the "repl" environment
     */
    if (this.application.environment === 'repl') {
      return
    }

    this.application.container.withBindings(
      ['Adonis/Core/Validator', 'Adonis/Core/Logger'],
      (Validator, Logger) => {
        const { extendValidator } = require('../src/Bindings/Validator')
        extendValidator(Validator.validator, Logger)
      }
    )
  }

  public register() {
    this.application.container.bind('Adonis/Addons/ResponsiveAttachment', () => {
      const { ResponsiveAttachment } = require('../src/Attachment')
      const { responsiveAttachment } = require('../src/Attachment/decorator')

      return {
        ResponsiveAttachment: ResponsiveAttachment,
        responsiveAttachment: responsiveAttachment,
      }
    })
  }

  public boot() {
    this.application.container.withBindings(
      ['Adonis/Addons/ResponsiveAttachment', 'Adonis/Core/Drive', 'Adonis/Core/Logger'],
      (ResponsiveAttachmentAddon, Drive, Logger) => {
        ResponsiveAttachmentAddon.ResponsiveAttachment.setDrive(Drive)
        ResponsiveAttachmentAddon.ResponsiveAttachment.setLogger(Logger)
      }
    )

    this.defineValidationRules()
  }
}
