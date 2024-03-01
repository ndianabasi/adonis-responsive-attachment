/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi@furnish.ng>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

declare module '@ioc:Adonis/Core/Validator' {
  import { Rule } from '@ioc:Adonis/Core/Validator'

  export interface Rules {
    /**
     * Ensure image width does not exceed the specified width.
     *
     * Provided by the Adonis Responsive Attachment addon.
     */
    maxImageWidth(value: number): Rule
    /**
     * Ensure image height does not exceed the specified height.
     *
     * Provided by the Adonis Responsive Attachment addon.
     */
    maxImageHeight(value: number): Rule
    /**
     * Ensure image width is above the specified width.
     *
     * Provided by the Adonis Responsive Attachment addon.
     */
    minImageWidth(value: number): Rule
    /**
     * Ensure image height is above the specified height.
     *
     * Provided by the Adonis Responsive Attachment addon.
     */
    minImageHeight(value: number): Rule
    /**
     * Ensure image aspect ratio matches the specified aspect ratio
     *
     * Provided by the Adonis Responsive Attachment addon.
     */
    imageAspectRatio(value: number): Rule
  }
}
