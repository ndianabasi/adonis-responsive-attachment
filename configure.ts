/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi[at]gotedo[dot]com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type Configure from '@adonisjs/core/commands/configure'

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  /**
   * Publish provider
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('adonis-responsive-attachment/provider')
  })
}
