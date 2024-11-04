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
import { ResponsiveAttachment } from '../src/Attachment/index'
import { setup, cleanup, setupApplication, rollbackDB } from '../test-helpers'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { BodyParserMiddleware } from '@adonisjs/bodyparser/build/src/BodyParser'
import { extendValidator } from '../src/Bindings/Validator'
import { validator } from '@adonisjs/validator/build/src/Validator'

let app: ApplicationContract

test.group('ResponsiveAttachment | Validator | Failures', (group) => {
  group.before(async () => {
    app = await setupApplication()
    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
    extendValidator(validator, app.logger)
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

  const dataset = ['default_message', 'custom_message'] as const

  test('should return validation error if image is below the minimum image width', async (assert) => {
    for (const condition of dataset) {
      const useDefaultMessage = condition === 'default_message'

      const server = createServer((req, res) => {
        assert.plan(2)

        const ctx = app.container
          .resolveBinding('Adonis/Core/HttpContext')
          .create('/', {}, req, res)

        const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

        app.container.make(BodyParserMiddleware).handle(ctx, async () => {
          try {
            await ctx.request.validate({
              schema: schema.create({ avatar: schema.file(undefined, [rules.minImageWidth(520)]) }),
              messages: useDefaultMessage
                ? undefined
                : {
                    'avatar.minImageWidth': 'Minimum image width is {{ options.minImageWidth }}px',
                  },
            })
          } catch (error) {
            assert.deepEqual(error.messages, {
              avatar: [
                useDefaultMessage
                  ? 'minImageWidth validation failure'
                  : 'Minimum image width is 520px',
              ],
            })
          }
          ctx.response.finish()
        })
      })

      await supertest(server)
        .post('/')
        .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-150x100.jpg'))
    }
  })

  test('should return validation error if image is below the minimum image height', async (assert) => {
    for (const condition of dataset) {
      const useDefaultMessage = condition === 'default_message'

      const server = createServer((req, res) => {
        assert.plan(2)

        const ctx = app.container
          .resolveBinding('Adonis/Core/HttpContext')
          .create('/', {}, req, res)

        const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

        app.container.make(BodyParserMiddleware).handle(ctx, async () => {
          try {
            await ctx.request.validate({
              schema: schema.create({
                avatar: schema.file(undefined, [rules.minImageHeight(720)]),
              }),
              messages: useDefaultMessage
                ? undefined
                : {
                    'avatar.minImageHeight':
                      'Minimum image height is {{ options.minImageHeight }}px',
                  },
            })
          } catch (error) {
            assert.deepEqual(error.messages, {
              avatar: [
                useDefaultMessage
                  ? 'minImageHeight validation failure'
                  : 'Minimum image height is 720px',
              ],
            })
          }
          ctx.response.finish()
        })
      })

      await supertest(server)
        .post('/')
        .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-150x100.jpg'))
    }
  })

  test('should return validation error if image is above the maximum image width', async (assert) => {
    for (const condition of dataset) {
      const useDefaultMessage = condition === 'default_message'

      const server = createServer((req, res) => {
        assert.plan(2)

        const ctx = app.container
          .resolveBinding('Adonis/Core/HttpContext')
          .create('/', {}, req, res)

        const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

        app.container.make(BodyParserMiddleware).handle(ctx, async () => {
          try {
            await ctx.request.validate({
              schema: schema.create({ avatar: schema.file(undefined, [rules.maxImageWidth(720)]) }),
              messages: useDefaultMessage
                ? undefined
                : {
                    'avatar.maxImageWidth': 'Maximum image width is {{ options.maxImageWidth }}px',
                  },
            })
          } catch (error) {
            assert.deepEqual(error.messages, {
              avatar: [
                useDefaultMessage
                  ? 'maxImageWidth validation failure'
                  : 'Maximum image width is 720px',
              ],
            })
          }
          ctx.response.finish()
        })
      })

      await supertest(server)
        .post('/')
        .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
    }
  })

  test('should return validation error if image is above the maximum image height', async (assert) => {
    for (const condition of dataset) {
      const useDefaultMessage = condition === 'default_message'

      const server = createServer((req, res) => {
        assert.plan(2)

        const ctx = app.container
          .resolveBinding('Adonis/Core/HttpContext')
          .create('/', {}, req, res)

        const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

        app.container.make(BodyParserMiddleware).handle(ctx, async () => {
          try {
            await ctx.request.validate({
              schema: schema.create({
                avatar: schema.file(undefined, [rules.maxImageHeight(720)]),
              }),
              messages: useDefaultMessage
                ? undefined
                : {
                    'avatar.maxImageHeight':
                      'Maximum image height is {{ options.maxImageHeight }}px',
                  },
            })
          } catch (error) {
            assert.deepEqual(error.messages, {
              avatar: [
                useDefaultMessage
                  ? 'maxImageHeight validation failure'
                  : 'Maximum image height is 720px',
              ],
            })
          }
          ctx.response.finish()
        })
      })

      await supertest(server)
        .post('/')
        .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
    }
  })

  test('should return validation error if image does not match the aspect ratio', async (assert) => {
    for (const condition of dataset) {
      const useDefaultMessage = condition === 'default_message'

      const server = createServer((req, res) => {
        assert.plan(2)

        const ctx = app.container
          .resolveBinding('Adonis/Core/HttpContext')
          .create('/', {}, req, res)

        const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

        app.container.make(BodyParserMiddleware).handle(ctx, async () => {
          try {
            await ctx.request.validate({
              schema: schema.create({
                avatar: schema.file(undefined, [rules.imageAspectRatio(2.45)]),
              }),
              messages: useDefaultMessage
                ? undefined
                : {
                    'avatar.imageAspectRatio':
                      'Required image aspect-ratio is {{ options.imageAspectRatio }}',
                  },
            })
          } catch (error) {
            assert.deepEqual(error.messages, {
              avatar: [
                useDefaultMessage
                  ? 'imageAspectRatio validation failure'
                  : 'Required image aspect-ratio is 2.45',
              ],
            })
          }
          ctx.response.finish()
        })
      })

      await supertest(server)
        .post('/')
        .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
    }
  })

  test('should return validation error if validation value is not provided', async (assert) => {
    const server = createServer((req, res) => {
      assert.plan(1)

      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        try {
          await ctx.request.validate({
            schema: schema.create({
              // @ts-expect-error
              avatar: schema.file(undefined, [rules.imageAspectRatio()]),
            }),
          })
        } catch (error) {
          assert.equal(error.message, '"imageAspectRatio" rule expects a "validationValue"')
        }
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })
})

test.group('ResponsiveAttachment | Validator | Successes', (group) => {
  group.before(async () => {
    app = await setupApplication()
    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
    extendValidator(validator, app.logger)
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

  test('should not throw validation error if image is above the minimum width', async (assert) => {
    const server = createServer((req, res) => {
      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const payload = await ctx.request.validate({
          schema: schema.create({ avatar: schema.file(undefined, [rules.minImageWidth(520)]) }),
        })
        assert.isDefined(payload.avatar)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('should not throw validation error if image is above the minimum image height', async (assert) => {
    const server = createServer((req, res) => {
      assert.plan(1)

      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const payload = await ctx.request.validate({
          schema: schema.create({ avatar: schema.file(undefined, [rules.minImageHeight(520)]) }),
        })
        assert.isDefined(payload.avatar)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })

  test('should not throw validation error if image is below the maximum image width', async (assert) => {
    const server = createServer((req, res) => {
      assert.plan(1)

      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const payload = await ctx.request.validate({
          schema: schema.create({ avatar: schema.file(undefined, [rules.maxImageWidth(520)]) }),
        })
        assert.isDefined(payload.avatar)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-150x100.jpg'))
  })

  test('should not throw validation error if image is below the maximum image height', async (assert) => {
    const server = createServer((req, res) => {
      assert.plan(1)

      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const payload = await ctx.request.validate({
          schema: schema.create({ avatar: schema.file(undefined, [rules.maxImageHeight(520)]) }),
        })
        assert.isDefined(payload.avatar)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-150x100.jpg'))
  })

  test('should not throw validation error if image matches the expected aspect ratio', async (assert) => {
    const server = createServer((req, res) => {
      assert.plan(1)

      const ctx = app.container.resolveBinding('Adonis/Core/HttpContext').create('/', {}, req, res)

      const { rules, schema } = app.container.resolveBinding('Adonis/Core/Validator')

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const payload = await ctx.request.validate({
          schema: schema.create({ avatar: schema.file(undefined, [rules.imageAspectRatio(1.5)]) }),
        })
        assert.isDefined(payload.avatar)
        ctx.response.finish()
      })
    })

    await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))
  })
})
