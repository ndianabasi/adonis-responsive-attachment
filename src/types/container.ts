/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi[at]gotedo[dot]com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

declare module '@ioc:Adonis/Core/Application' {
  import ResponsiveAttachment from '@ioc:Adonis/Addons/ResponsiveAttachment'

  interface ContainerBindings {
    'Adonis/Addons/ResponsiveAttachment': typeof ResponsiveAttachment
  }
}

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    'adonis-responsive-attachment.decorator': Decorator
  }
}
