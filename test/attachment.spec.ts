/*
 * adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi@furnish.ng>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import 'reflect-metadata'

import test from 'japa'
import { join } from 'path'
import supertest from 'supertest'
import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { ResponsiveAttachment } from '../src/Attachment/index'
import { setup, cleanup, setupApplication, rollbackDB } from '../test-helpers'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { responsiveAttachment as Attachment } from '../src/Attachment/decorator'
import { getDimensions } from '../src/Helpers/image_manipulation_helper'
import { BodyParserMiddleware } from '@adonisjs/bodyparser/build/src/BodyParser'
import { ResponsiveAttachmentContract } from '@ioc:Adonis/Addons/ResponsiveAttachment'
import { isBlurhashValid } from 'blurhash'

let app: ApplicationContract

const samplePersistedImageData = {
  isPersisted: true,
  isLocal: false,
  name: 'original_ckw5lpv7v0002egvobe1b0oav.jpg',
  size: 291.69,
  width: 1500,
  format: 'jpeg',
  height: 1000,
  extname: 'jpg',
  mimeType: 'image/jpeg',
  breakpoints: {
    thumbnail: {
      name: 'thumbnail_ckw5lpv7v0002egvobe1b0oav.jpg',
      extname: 'jpg',
      mimeType: 'image/jpeg',
      width: 234,
      height: 156,
      size: 7.96,
    },
    large: {
      name: 'large_ckw5lpv7v0002egvobe1b0oav.jpg',
      extname: 'jpg',
      mimeType: 'image/jpeg',
      width: 1000,
      height: 667,
      size: 129.15,
    },
    medium: {
      name: 'medium_ckw5lpv7v0002egvobe1b0oav.jpg',
      extname: 'jpg',
      mimeType: 'image/jpeg',
      width: 750,
      height: 500,
      size: 71.65,
    },
    small: {
      name: 'small_ckw5lpv7v0002egvobe1b0oav.jpg',
      extname: 'jpg',
      mimeType: 'image/jpeg',
      width: 500,
      height: 333,
      size: 32.21,
    },
  },
}

test.group('ResponsiveAttachment | fromDbResponse', (group) => {
  group.before(async () => {
    app = await setupApplication()
    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create image attachment instance from db response', (assert) => {
    const responsiveAttachment = ResponsiveAttachment.fromDbResponse(
      JSON.stringify(samplePersistedImageData)
    )

    assert.isTrue(responsiveAttachment?.isPersisted)
    assert.isFalse(responsiveAttachment?.isLocal)
  })

  test('save method should result in noop when image attachment is created from db response', async (assert) => {
    const responsiveAttachment = ResponsiveAttachment.fromDbResponse(
      JSON.stringify(samplePersistedImageData)
    )

    await responsiveAttachment?.save()
    assert.equal(responsiveAttachment?.name, 'original_ckw5lpv7v0002egvobe1b0oav.jpg')
    assert.equal(
      responsiveAttachment?.breakpoints?.thumbnail.name,
      'thumbnail_ckw5lpv7v0002egvobe1b0oav.jpg'
    )
    assert.equal(
      responsiveAttachment?.breakpoints?.small.name,
      'small_ckw5lpv7v0002egvobe1b0oav.jpg'
    )
    assert.equal(
      responsiveAttachment?.breakpoints?.medium.name,
      'medium_ckw5lpv7v0002egvobe1b0oav.jpg'
    )
    assert.equal(
      responsiveAttachment?.breakpoints?.large.name,
      'large_ckw5lpv7v0002egvobe1b0oav.jpg'
    )
  })

  test('delete persisted images', async (assert) => {
    const responsiveAttachment = ResponsiveAttachment.fromDbResponse(
      JSON.stringify(samplePersistedImageData)
    )

    await responsiveAttachment?.delete()
    assert.isTrue(responsiveAttachment?.isDeleted)
  })

  test('compute image urls', async (assert) => {
    const responsiveAttachment = ResponsiveAttachment.fromDbResponse(
      JSON.stringify(samplePersistedImageData)
    )

    responsiveAttachment?.setOptions({ preComputeUrls: true })

    const urls = await responsiveAttachment?.getUrls()

    assert.match(urls?.url!, /\/uploads\/original_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/)
    assert.match(
      urls?.breakpoints?.thumbnail.url!,
      /\/uploads\/thumbnail_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
    assert.match(
      urls?.breakpoints?.small.url!,
      /\/uploads\/small_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
    assert.match(
      urls?.breakpoints?.large.url!,
      /\/uploads\/large_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
    assert.match(
      urls?.breakpoints?.medium.url!,
      /\/uploads\/medium_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
  })

  test('compute image urls from a custom method', async (assert) => {
    const responsiveAttachment = ResponsiveAttachment.fromDbResponse(
      JSON.stringify(samplePersistedImageData)
    )

    responsiveAttachment?.setOptions({
      preComputeUrls: async (_, image: ResponsiveAttachment) => {
        return {
          url: `/custom_folder/${image.name!}?signature=eyJtZXNzYWdlIjoiL3VwbG9hZHMvb3JpZ2luYWxfY2t3NWxwdjd2MDAwMmVndm9iZTFiMG9hdi5qcGcifQ.ieXMlaRb8izlREvJ0E9iMY0I3iedalmv-pvOUIrfEZc`,
          breakpoints: {
            thumbnail: {
              url: `/custom_folder/${image.breakpoints?.thumbnail
                .name!}?signature=eyJtZXNzYWdlIjoiL3VwbG9hZHMvdGh1bWJuYWlsX2NrdzVscHY3djAwMDJlZ3ZvYmUxYjBvYXYuanBnIn0.RGGimHh6NuyPrB2ZgmudE7rH4RRCT3NL7kex9EmSyIo`,
            },
            small: {
              url: `/custom_folder/${image.breakpoints?.small
                .name!}?signature=eyJtZXNzYWdlIjoiL3VwbG9hZHMvbGFyZ2VfY2t3NWxwdjd2MDAwMmVndm9iZTFiMG9hdi5qcGcifQ.eNC8DaqYCYd4khKhqS7DKI66SsLpD-vyVIaP8rzMmAA`,
            },
            medium: {
              url: `/custom_folder/${image.breakpoints?.medium
                .name!}?signature=eyJtZXNzYWdlIjoiL3VwbG9hZHMvbWVkaXVtX2NrdzVscHY3djAwMDJlZ3ZvYmUxYjBvYXYuanBnIn0.2ADmssxFC0vxmq4gJEgjb9Fxo1qcQ6tMVeKBqZ1ENkM`,
            },
            large: {
              url: `/custom_folder/${image.breakpoints?.large
                .name!}?signature=eyJtZXNzYWdlIjoiL3VwbG9hZHMvc21hbGxfY2t3NWxwdjd2MDAwMmVndm9iZTFiMG9hdi5qcGcifQ.I8fwMRwY5azvlS_8B0K40BWKQNLuS-HqCB_3RXryOok`,
            },
          },
        }
      },
    })

    await responsiveAttachment?.computeUrls()

    assert.match(
      responsiveAttachment?.url!,
      /\/custom_folder\/original_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
    assert.match(
      responsiveAttachment?.urls?.breakpoints?.small.url!,
      /\/custom_folder\/small_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
    assert.match(
      responsiveAttachment?.urls?.breakpoints?.large.url!,
      /\/custom_folder\/large_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
    assert.match(
      responsiveAttachment?.urls?.breakpoints?.medium.url!,
      /\/custom_folder\/medium_ckw5lpv7v0002egvobe1b0oav\.jpg\?signature=/
    )
  })
})

test.group('ResponsiveAttachment | fromFile', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create attachment from the user-uploaded image', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.isTrue(await Drive.exists(body.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.thumbnail.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.small.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.medium.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.large.name))
  })

  test('change the format of the user-uploaded image', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ preComputeUrls: true, forceFormat: 'webp' })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.include(responsiveAttachment?.name!, 'webp')
        assert.include(responsiveAttachment?.breakpoints?.thumbnail.name!, 'webp')
        assert.include(responsiveAttachment?.breakpoints?.small.name!, 'webp')
        assert.include(responsiveAttachment?.breakpoints?.medium.name!, 'webp')
        assert.include(responsiveAttachment?.breakpoints?.large.name!, 'webp')

        assert.include(responsiveAttachment?.url!, 'webp')
        assert.include(responsiveAttachment?.urls?.breakpoints?.large.url!, 'webp')
        assert.include(responsiveAttachment?.urls?.breakpoints?.medium.url!, 'webp')
        assert.include(responsiveAttachment?.urls?.breakpoints?.small.url!, 'webp')
        assert.include(responsiveAttachment?.urls?.breakpoints?.thumbnail.url!, 'webp')

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('pre-compute urls for newly-created images', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ preComputeUrls: true })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isNotEmpty(responsiveAttachment?.urls)

        assert.isDefined(responsiveAttachment?.url)
        assert.isDefined(responsiveAttachment?.urls?.breakpoints?.large.url)
        assert.isDefined(responsiveAttachment?.urls?.breakpoints?.medium.url)
        assert.isDefined(responsiveAttachment?.urls?.breakpoints?.small.url)
        assert.isDefined(responsiveAttachment?.urls?.breakpoints?.thumbnail.url)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))

        assert.isTrue(
          responsiveAttachment?.breakpoints!.thumbnail.size! <
            responsiveAttachment?.breakpoints!.small.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints!.small.size! <
            responsiveAttachment?.breakpoints!.medium.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints!.medium.size! <
            responsiveAttachment?.breakpoints!.large.size!
        )
        assert.isTrue(responsiveAttachment?.breakpoints!.large.size! < responsiveAttachment?.size!)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('delete local images', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ preComputeUrls: true })
        await responsiveAttachment?.save()
        await responsiveAttachment?.delete()

        assert.isFalse(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)
        assert.isTrue(responsiveAttachment?.isDeleted)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.isDefined(body.url)
    assert.isDefined(body.breakpoints.large.url)
    assert.isDefined(body.breakpoints.medium.url)
    assert.isDefined(body.breakpoints.small.url)
    assert.isDefined(body.breakpoints.thumbnail.url)

    assert.isNotNull(body.url)
    assert.isNotNull(body.breakpoints.large.url)
    assert.isNotNull(body.breakpoints.medium.url)
    assert.isNotNull(body.breakpoints.small.url)
    assert.isNotNull(body.breakpoints.thumbnail.url)

    assert.isFalse(await Drive.exists(body.name))
    assert.isFalse(await Drive.exists(body.breakpoints.large.name))
    assert.isFalse(await Drive.exists(body.breakpoints.medium.name))
    assert.isFalse(await Drive.exists(body.breakpoints.small.name))
    assert.isFalse(await Drive.exists(body.breakpoints.thumbnail.name))
  })

  test('do not create any image when image is not attached', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = file ? await ResponsiveAttachment.fromFile(file) : null
        await responsiveAttachment?.save()

        assert.isNull(responsiveAttachment)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    assert.isEmpty(body)
  })
})

test.group('ImageManipulationHelper', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('getDimensions', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        await file.moveToDisk(app.tmpPath('uploads'), { name: file.clientName })
        const buffer = await Drive.get(join(app.tmpPath('uploads'), file.clientName))
        const { width, height } = await getDimensions(buffer)

        assert.equal(width, 1500)
        assert.equal(height, 1000)

        ctx.response.send({ width, height })
        ctx.response.finish()
      })
    })

    const {
      body: { width, height },
    } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.equal(width, 1500)
    assert.equal(height, 1000)
  })
})

test.group('Images below the thumbnail resize options', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })
  test('does not create thumbnail and responsive images for files below the THUMBNAIL_RESIZE_OPTIONS', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isUndefined(responsiveAttachment?.breakpoints)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-150x100.jpg'))
  })

  test('pre-compute urls for newly created image below the THUMBNAIL_RESIZE_OPTIONS', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ preComputeUrls: true })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isNotEmpty(responsiveAttachment?.urls)

        assert.isDefined(responsiveAttachment?.url)
        assert.isNotNull(responsiveAttachment?.url)

        assert.isUndefined(responsiveAttachment?.urls?.breakpoints)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-150x100.jpg'))
  })
})

test.group('Images below the large breakeven point', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create attachment from the user uploaded image', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))

        assert.isUndefined(responsiveAttachment?.breakpoints?.large)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-825x550.jpg'))
  })

  test('pre-compute urls for newly created images', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ preComputeUrls: true })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isDefined(responsiveAttachment?.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.medium.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.small.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.thumbnail.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.large)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))

        assert.isUndefined(responsiveAttachment?.breakpoints?.large)

        assert.isTrue(
          responsiveAttachment?.breakpoints!.thumbnail.size! <
            responsiveAttachment?.breakpoints!.small.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints!.small.size! <
            responsiveAttachment?.breakpoints!.medium.size!
        )
        assert.isTrue(responsiveAttachment?.breakpoints!.medium.size! < responsiveAttachment?.size!)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-825x550.jpg'))
  })
})

test.group(
  'Do not generate responsive images when `options.responsiveDimensions` is false',
  (group) => {
    group.before(async () => {
      app = await setupApplication()
      await setup(app)

      app.container.resolveBinding('Adonis/Core/Route').commit()
      ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
      ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
    })

    group.beforeEach(async () => {
      await setup(app)
    })

    group.afterEach(async () => {
      await rollbackDB(app)
    })

    group.after(async () => {
      await cleanup(app)
    })

    test('create attachment from the user uploaded image', async (assert) => {
      const Drive = app.container.resolveBinding('Adonis/Core/Drive')

      const server = createServer((req, res) => {
        const ctx = app.container
          .resolveBinding('Adonis/Core/HttpContext')
          .create('/', {}, req, res)
        app.container.make(BodyParserMiddleware).handle(ctx, async () => {
          const file = ctx.request.file('avatar')!
          const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
          responsiveAttachment?.setOptions({ responsiveDimensions: false })
          await responsiveAttachment?.save()

          assert.isTrue(responsiveAttachment?.isPersisted)
          assert.isTrue(responsiveAttachment?.isLocal)

          assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
          assert.isUndefined(responsiveAttachment?.breakpoints)

          ctx.response.send(responsiveAttachment)
          ctx.response.finish()
        })
      })

      await supertest(server)
        .post('/')
        .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-825x550.jpg'))
    })

    test('pre-compute urls for newly created images', async (assert) => {
      const Drive = app.container.resolveBinding('Adonis/Core/Drive')

      const server = createServer((req, res) => {
        const ctx = app.container
          .resolveBinding('Adonis/Core/HttpContext')
          .create('/', {}, req, res)

        app.container.make(BodyParserMiddleware).handle(ctx, async () => {
          const file = ctx.request.file('avatar')!
          const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
          responsiveAttachment?.setOptions({ preComputeUrls: true, responsiveDimensions: false })
          await responsiveAttachment?.save()

          assert.isTrue(responsiveAttachment?.isPersisted)
          assert.isTrue(responsiveAttachment?.isLocal)

          assert.isNotEmpty(responsiveAttachment?.urls)

          assert.isDefined(responsiveAttachment?.url)
          assert.isNotNull(responsiveAttachment?.url)
          assert.isUndefined(responsiveAttachment?.urls?.breakpoints)

          assert.isTrue(await Drive.exists(responsiveAttachment?.name!))

          ctx.response.send(responsiveAttachment)
          ctx.response.finish()
        })
      })

      await supertest(server)
        .post('/')
        .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-825x550.jpg'))
    })
  }
)

test.group('Do not generate thumbnail images when `options.disableThumbnail` is true', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create attachment from the user uploaded image', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ disableThumbnail: true })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))

        assert.isUndefined(responsiveAttachment?.breakpoints?.thumbnail)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('pre-compute urls for newly created images', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ preComputeUrls: true, disableThumbnail: true })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isNotEmpty(responsiveAttachment?.urls)

        assert.isDefined(responsiveAttachment?.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.small.url!)
        assert.isUndefined(responsiveAttachment?.breakpoints?.medium.url!)
        assert.isUndefined(responsiveAttachment?.breakpoints?.large.url!)
        assert.isUndefined(responsiveAttachment?.breakpoints?.thumbnail)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })
})

test.group('Do not generate responsive images when some default breakpoints are `off`', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create attachment from the user uploaded image', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({
          breakpoints: { medium: 'off', small: 'off' },
        })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))

        assert.isUndefined(responsiveAttachment?.breakpoints?.medium)
        assert.isUndefined(responsiveAttachment?.breakpoints?.small)

        assert.isTrue(
          responsiveAttachment?.breakpoints!.thumbnail.size! <
            responsiveAttachment?.breakpoints!.large.size!
        )
        assert.isTrue(responsiveAttachment?.breakpoints!.large.size! < responsiveAttachment?.size!)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('pre-compute urls for newly created images', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({
          preComputeUrls: true,
          breakpoints: { medium: 'off', small: 'off' },
        })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isNotEmpty(responsiveAttachment?.urls)

        assert.isDefined(responsiveAttachment?.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.large.url!)
        assert.isUndefined(responsiveAttachment?.breakpoints?.thumbnail.url!)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })
})

test.group('Manual generation of URLs', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('generate URLs for the images', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ preComputeUrls: true })
        await responsiveAttachment?.save()
        const urls = await responsiveAttachment?.getUrls()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.match(urls?.url!, /^\/uploads\/original.+\?signature=.+$/)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })
})

test.group('ResponsiveAttachment | Custom breakpoints', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create attachment from the user uploaded image', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({
          breakpoints: { small: 400, medium: 700, large: 1000, xlarge: 1200 },
        })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.xlarge.name!))

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.isTrue(await Drive.exists(body.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.thumbnail.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.small.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.medium.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.large.name))
    assert.isTrue(await Drive.exists(body.breakpoints?.xlarge.name))
  })

  test('pre-compute urls for newly created images', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({
          breakpoints: { small: 400, medium: 700, large: 1000, xlarge: 1200 },
          preComputeUrls: true,
        })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isDefined(responsiveAttachment?.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.xlarge.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.large.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.medium.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.small.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.thumbnail.url)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.xlarge.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))

        assert.equal(responsiveAttachment?.width, 1500)
        assert.equal(responsiveAttachment?.breakpoints?.xlarge.width!, 1200)
        assert.equal(responsiveAttachment?.breakpoints?.large.width!, 1000)
        assert.equal(responsiveAttachment?.breakpoints?.medium.width!, 700)
        assert.equal(responsiveAttachment?.breakpoints?.small.width!, 400)

        assert.isTrue(
          responsiveAttachment?.breakpoints?.thumbnail.size! <
            responsiveAttachment?.breakpoints!.small.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints?.small.size! <
            responsiveAttachment?.breakpoints!.medium.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints?.medium.size! <
            responsiveAttachment?.breakpoints!.large.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints?.large.size! <
            responsiveAttachment?.breakpoints?.xlarge.size!
        )
        assert.isTrue(responsiveAttachment?.breakpoints!.xlarge.size! < responsiveAttachment?.size!)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })
})

test.group('ResponsiveAttachment | fromBuffer', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create attachment from the user-provided buffer', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const readableStream = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const responsiveAttachment = await ResponsiveAttachment.fromBuffer(readableStream)
        await responsiveAttachment.save()

        assert.isTrue(responsiveAttachment.isPersisted)
        assert.isTrue(responsiveAttachment.isLocal)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    assert.isTrue(await Drive.exists(body.name))
  })

  test('pre-compute url for newly-created images', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const readableStream = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const responsiveAttachment = await ResponsiveAttachment.fromBuffer(readableStream)
        responsiveAttachment.setOptions({ preComputeUrls: true })
        await responsiveAttachment.save()

        assert.isTrue(responsiveAttachment.isPersisted)
        assert.isTrue(responsiveAttachment.isLocal)

        assert.isDefined(responsiveAttachment?.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.large.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.medium.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.small.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.thumbnail.url)

        assert.isTrue(await Drive.exists(responsiveAttachment?.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))

        assert.isTrue(
          responsiveAttachment?.breakpoints!.thumbnail.size! <
            responsiveAttachment?.breakpoints!.small.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints!.small.size! <
            responsiveAttachment?.breakpoints!.medium.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints!.medium.size! <
            responsiveAttachment?.breakpoints!.large.size!
        )
        assert.isTrue(responsiveAttachment?.breakpoints!.large.size! < responsiveAttachment?.size!)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    assert.isDefined(body.url)
  })

  test('delete local images', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const readableStream = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const responsiveAttachment = await ResponsiveAttachment.fromBuffer(readableStream)
        responsiveAttachment.setOptions(undefined)
        await responsiveAttachment.save()
        await responsiveAttachment.delete()

        assert.isFalse(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)
        assert.isTrue(responsiveAttachment?.isDeleted)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    assert.isFalse(await Drive.exists(body.name))
    assert.isFalse(await Drive.exists(body.breakpoints.large.name))
    assert.isFalse(await Drive.exists(body.breakpoints.medium.name))
    assert.isFalse(await Drive.exists(body.breakpoints.small.name))
    assert.isFalse(await Drive.exists(body.breakpoints.thumbnail.name))
  })
})

test.group('ResponsiveAttachment | errors', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('throw error if unallowed file type is provided to `fromBuffer` method', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        assert.plan(1)

        const readableStream = await readFile(join(__dirname, '../unallowed_file.pdf'))
        try {
          const responsiveAttachment = await ResponsiveAttachment.fromBuffer(readableStream)
          ctx.response.send(responsiveAttachment)
          ctx.response.finish()
        } catch (error) {
          assert.equal(
            error.message,
            `Uploaded file is not an allowable image. Make sure that you uploaded only the following format: "jpeg", "png", "webp", "tiff", and "avif".`
          )
          ctx.response.send(error)
          ctx.response.finish()
        }
      })
    })

    await supertest(server).post('/')
  })

  test('throw error if unallowed file type is provided to `fromFile` method', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        assert.plan(1)

        const file = ctx.request.file('avatar')!
        try {
          const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
          ctx.response.send(responsiveAttachment)
          ctx.response.finish()
        } catch (error) {
          assert.equal(
            error.message,
            `[Adonis Responsive Attachment] Uploaded file is not an allowable image. Make sure that you uploaded only the following format: "jpeg", "png", "webp", "tiff", and "avif".`
          )
          ctx.response.send(error)
          ctx.response.finish()
        }
      })
    })

    await supertest(server).post('/').attach('avatar', join(__dirname, '../unallowed_file.pdf'))
  })

  test('throw error if a `falsy` value is provided to `fromFile` method', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        assert.plan(1)

        try {
          const responsiveAttachment = await ResponsiveAttachment.fromFile(undefined!)
          ctx.response.send(responsiveAttachment)
          ctx.response.finish()
        } catch (error) {
          assert.equal(error.message, 'You should provide a non-falsy value')
          ctx.response.send(error)
          ctx.response.finish()
        }
      })
    })

    await supertest(server).post('/')
  })
})

test.group('Do not generate save original image when `options.keepOriginal` is false', (group) => {
  group.before(async () => {
    app = await setupApplication()
    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('create attachment from the user uploaded image', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ keepOriginal: false })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isUndefined(responsiveAttachment?.name)
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.notExists(body.name)
    assert.notExists(body.size)
    assert.notExists(body.width)
    assert.notExists(body.format)
    assert.notExists(body.height)
    assert.notExists(body.extname)
    assert.notExists(body.mimeType)
    assert.notExists(body.url)
  })

  test('pre-compute urls for newly-created images', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({
          preComputeUrls: true,
          keepOriginal: false,
        })
        await responsiveAttachment?.save()

        assert.isTrue(responsiveAttachment?.isPersisted)
        assert.isTrue(responsiveAttachment?.isLocal)

        assert.isUndefined(responsiveAttachment?.url)
        assert.isUndefined(responsiveAttachment?.name!)

        assert.isUndefined(responsiveAttachment?.breakpoints?.large.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.medium.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.small.url)
        assert.isUndefined(responsiveAttachment?.breakpoints?.thumbnail.url)

        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.large.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.medium.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.small.name!))
        assert.isTrue(await Drive.exists(responsiveAttachment?.breakpoints?.thumbnail.name!))

        assert.isTrue(
          responsiveAttachment?.breakpoints!.thumbnail.size! <
            responsiveAttachment?.breakpoints!.small.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints!.small.size! <
            responsiveAttachment?.breakpoints!.medium.size!
        )
        assert.isTrue(
          responsiveAttachment?.breakpoints!.medium.size! <
            responsiveAttachment?.breakpoints!.large.size!
        )

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.notExists(body.name)
    assert.notExists(body.size)
    assert.notExists(body.width)
    assert.notExists(body.format)
    assert.notExists(body.height)
    assert.notExists(body.extname)
    assert.notExists(body.mimeType)
    assert.notExists(body.url)
  })
})

test.group('Other checks', (group) => {
  group.before(async () => {
    app = await setupApplication()
    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('change the folder for an upload at run-time', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        class User extends BaseModel {
          @column({ isPrimary: true })
          public id: string

          @column()
          public username: string

          @Attachment({ folder: 'a' })
          public avatar: ResponsiveAttachmentContract | null
        }

        const file = ctx.request.file('avatar')!
        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = await ResponsiveAttachment.fromFile(file)
        user.avatar.setOptions({ folder: 'a/b/c' })
        await user.save()

        assert.include(user.avatar?.name!, 'a/b/c')
        assert.include(user.avatar?.breakpoints?.thumbnail.name!, 'a/b/c')
        assert.include(user.avatar?.breakpoints?.small.name!, 'a/b/c')
        assert.include(user.avatar?.breakpoints?.medium.name!, 'a/b/c')
        assert.include(user.avatar?.breakpoints?.large.name!, 'a/b/c')

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('ensure urls are return when "preComputeUrls" is "true"', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        class User extends BaseModel {
          @column({ isPrimary: true })
          public id: string

          @column()
          public username: string

          @Attachment({ folder: 'a' })
          public avatar: ResponsiveAttachmentContract | null
        }

        const file = ctx.request.file('avatar')!
        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = await ResponsiveAttachment.fromFile(file)
        user.avatar.setOptions({ folder: 'a/b/c', preComputeUrls: true })
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const response = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const body = response.body

    assert.isDefined(body.avatar.url)
    assert.isDefined(body.avatar.breakpoints.thumbnail.url)
    assert.isDefined(body.avatar.breakpoints.large.url)
    assert.isDefined(body.avatar.breakpoints.medium.url)
    assert.isDefined(body.avatar.breakpoints.small.url)
  })

  test('ensure urls are not persisted to the database', async (assert) => {
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @Attachment({ folder: 'a' })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = await ResponsiveAttachment.fromFile(file)
        user.avatar.setOptions({ folder: 'a/b/c', preComputeUrls: true })
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const response = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const createdUser = await User.findOrFail(response.body.id)

    assert.isUndefined(createdUser.avatar!.url)
    assert.isUndefined(createdUser.avatar!.breakpoints!.thumbnail.url)
    assert.isUndefined(createdUser.avatar!.breakpoints!.large.url)
    assert.isUndefined(createdUser.avatar!.breakpoints!.medium.url)
    assert.isUndefined(createdUser.avatar!.breakpoints!.small.url)
  })

  test('ensure urls can be computed with `getUrls()`', async (assert) => {
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @Attachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = await ResponsiveAttachment.fromFile(file)
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const response = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const createdUser = await User.findOrFail(response.body.id)
    const urls = await createdUser.avatar!.getUrls()

    assert.isDefined(urls!.url)
    assert.isDefined(urls!.breakpoints!.thumbnail.url)
    assert.isDefined(urls!.breakpoints!.large.url)
    assert.isDefined(urls!.breakpoints!.medium.url)
    assert.isDefined(urls!.breakpoints!.small.url)
  })

  test('should not include original attributes and url when "keepOriginal" is "false"', async (assert) => {
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @Attachment({ folder: 'a', keepOriginal: false })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = await ResponsiveAttachment.fromFile(file)
        await user.save()
        await user.refresh()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const response = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const createdUser = await User.findOrFail(response.body.id)
    let avatar = createdUser.toJSON().avatar
    assert.isUndefined(avatar!.url)
    assert.isUndefined(avatar!.breakpoints!.thumbnail.url)
    assert.isUndefined(avatar!.breakpoints!.large.url)
    assert.isUndefined(avatar!.breakpoints!.medium.url)
    assert.isUndefined(avatar!.breakpoints!.small.url)

    await createdUser.avatar!.getUrls()
    avatar = createdUser.toJSON().avatar

    assert.isUndefined(avatar!.url)
    assert.isUndefined(avatar!.name)
    assert.isDefined(avatar!.breakpoints!.thumbnail.url)
    assert.isDefined(avatar!.breakpoints!.large.url)
    assert.isDefined(avatar!.breakpoints!.medium.url)
    assert.isDefined(avatar!.breakpoints!.small.url)
  })

  test('accept custom file name in the "fromFile" method', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        class User extends BaseModel {
          @column({ isPrimary: true })
          public id: string

          @column()
          public username: string

          @Attachment()
          public avatar: ResponsiveAttachmentContract | null
        }

        const file = ctx.request.file('avatar')!
        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = await ResponsiveAttachment.fromFile(file, 'Ndianabasi Udonkang')
        await user.save()

        assert.include(user.avatar?.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.thumbnail.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.small.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.medium.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.large.name!, 'ndianabasi_udonkang')

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('accept custom file name in the "fromBuffer" method', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        class User extends BaseModel {
          @column({ isPrimary: true })
          public id: string

          @column()
          public username: string

          @Attachment()
          public avatar: ResponsiveAttachmentContract | null
        }

        const readableStream = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )

        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(readableStream, 'Ndianabasi Udonkang')
        await user.save()

        assert.include(user.avatar?.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.thumbnail.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.small.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.medium.name!, 'ndianabasi_udonkang')
        assert.include(user.avatar?.breakpoints?.large.name!, 'ndianabasi_udonkang')

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    await supertest(server).post('/')
  })
})

test.group('ResponsiveAttachment | Blurhash', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.beforeEach(async () => {
    await setup(app)
  })

  group.afterEach(async () => {
    await rollbackDB(app)
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('should create attachment with blurhash string in all responsive formats when enabled', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        responsiveAttachment?.setOptions({ blurhash: { enabled: true } })
        await responsiveAttachment?.save()

        assert.isNotEmpty(responsiveAttachment.blurhash)
        assert.isNotEmpty(responsiveAttachment.breakpoints?.small.blurhash)
        assert.isNotEmpty(responsiveAttachment.breakpoints?.large.blurhash)
        assert.isNotEmpty(responsiveAttachment.breakpoints?.medium.blurhash)
        assert.isNotEmpty(responsiveAttachment.breakpoints?.thumbnail.blurhash)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.isNotEmpty(body.blurhash)
    assert.isNotEmpty(body.breakpoints?.small.blurhash)
    assert.isNotEmpty(body.breakpoints?.large.blurhash)
    assert.isNotEmpty(body.breakpoints?.medium.blurhash)
    assert.isNotEmpty(body.breakpoints?.thumbnail.blurhash)
    // Check that blurhash is valid
    assert.isTrue(isBlurhashValid(body.blurhash).result)
    // All blurhashes should be the same
    assert.isTrue(
      body.blurhash === body.breakpoints?.small.blurhash &&
        body.blurhash === body.breakpoints?.medium.blurhash &&
        body.blurhash === body.breakpoints?.large.blurhash &&
        body.blurhash === body.breakpoints?.thumbnail.blurhash
    )
  })

  test('should not create attachment with blurhash string when disabled', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)
      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const responsiveAttachment = await ResponsiveAttachment.fromFile(file)
        // `blurhash` generation should be disabled if not specified
        // at all
        responsiveAttachment?.setOptions({})
        await responsiveAttachment?.save()

        assert.isUndefined(responsiveAttachment.blurhash)
        assert.isUndefined(responsiveAttachment.breakpoints?.small.blurhash)
        assert.isUndefined(responsiveAttachment.breakpoints?.large.blurhash)
        assert.isUndefined(responsiveAttachment.breakpoints?.medium.blurhash)
        assert.isUndefined(responsiveAttachment.breakpoints?.thumbnail.blurhash)

        ctx.response.send(responsiveAttachment)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    assert.isUndefined(body.blurhash)
    assert.isUndefined(body.breakpoints?.small.blurhash)
    assert.isUndefined(body.breakpoints?.large.blurhash)
    assert.isUndefined(body.breakpoints?.medium.blurhash)
    assert.isUndefined(body.breakpoints?.thumbnail.blurhash)
  })
})
