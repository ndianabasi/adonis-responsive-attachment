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
    maxImageWidth(value: number): Rule
    maxImageHeight(value: number): Rule
    minImageWidth(value: number): Rule
    minImageHeight(value: number): Rule
    imageAspectRatio(value: number): Rule
  }
}
