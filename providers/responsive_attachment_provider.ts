/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi[at]gotedo[dot]com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationService } from '@adonisjs/core/types'

export default class ResponsiveAttachmentProvider {
  constructor(protected application: ApplicationService) {}

  /**
   * Extends the validator by defining validation rules
   */
  private defineValidationRules() {
    /**
     * Do not register validation rules in the "repl" environment
     */
    if (this.application.nodeEnvironment === 'repl') {
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
    this.application.container.singleton('adonis-responsive-attachment', () => {
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
