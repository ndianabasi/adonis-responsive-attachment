/*
 * @ndianabasi/adonis-responsive-attachment
 *
 * (c) Ndianabasi Udonkang <ndianabasi.udonkang@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import 'reflect-metadata'

import test from 'japa'
import { join } from 'path'
import supertest from 'supertest'
import { createServer } from 'http'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { ResponsiveAttachmentContract } from '@ioc:Adonis/Addons/ResponsiveAttachment'
import { BodyParserMiddleware } from '@adonisjs/bodyparser/build/src/BodyParser'

import { ResponsiveAttachment } from '../src/Attachment'
import { responsiveAttachment } from '../src/Attachment/decorator'
import { setup, cleanup, setupApplication } from '../test-helpers'
import { readFile } from 'fs/promises'
import { isBlurhashValid } from 'blurhash'
import { readFileSync } from 'fs'

let app: ApplicationContract

type AttachmentBody = { body: { avatar: ResponsiveAttachmentContract } }

test.group('@responsiveAttachment | insert', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'Ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)

    assert.deepNestedInclude(users[0].avatar?.toJSON(), body.avatar)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    await User.create({ username: 'ndianabasi' })

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null

        try {
          await user.save()
        } catch (error) {}

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.isNull(users[0].avatar)

    assert.isFalse(await Drive.exists(body.avatar.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })
})

test.group('@responsiveAttachment | insert with transaction', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.useTransaction(trx).save()

        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), body.avatar)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    await User.create({ username: 'ndianabasi' })

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null

        try {
          await user.useTransaction(trx).save()
          await trx.commit()
        } catch (error) {
          await trx.rollback()
        }

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.isNull(users[0].avatar)

    assert.isFalse(await Drive.exists(body.avatar.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })

  test('cleanup attachments when rollback is called after success', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.useTransaction(trx).save()
        await trx.rollback()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 0)
    assert.isFalse(await Drive.exists(body.avatar.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })
})

test.group('@responsiveAttachment | update', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {})
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const { body: secondResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), secondResponse.avatar)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(await Drive.exists(secondResponse.avatar.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(secondResponse.avatar.url)
    assert.notExists(secondResponse.avatar.breakpoints?.large.url)
    assert.notExists(secondResponse.avatar.breakpoints?.medium.url)
    assert.notExists(secondResponse.avatar.breakpoints?.small.url)
    assert.notExists(secondResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      secondResponse.avatar.breakpoints?.thumbnail.size! <
        secondResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.small.size! <
        secondResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.medium.size! <
        secondResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(secondResponse.avatar.breakpoints?.large.size! < secondResponse.avatar.size!)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null

        try {
          await user.save()
        } catch {}

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const { body: secondResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isFalse(await Drive.exists(secondResponse.avatar.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)
  })
})

test.group('@responsiveAttachment | update with transaction', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()
        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const { body: secondResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), secondResponse.avatar)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(await Drive.exists(secondResponse.avatar.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(secondResponse.avatar.url)
    assert.notExists(secondResponse.avatar.breakpoints?.large.url)
    assert.notExists(secondResponse.avatar.breakpoints?.medium.url)
    assert.notExists(secondResponse.avatar.breakpoints?.small.url)
    assert.notExists(secondResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      secondResponse.avatar.breakpoints?.thumbnail.size! <
        secondResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.small.size! <
        secondResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.medium.size! <
        secondResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(secondResponse.avatar.breakpoints?.large.size! < secondResponse.avatar.size!)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null

        try {
          await user.useTransaction(trx).save()
          await trx.commit()
        } catch {
          await trx.rollback()
        }

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const { body: secondResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar!)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isFalse(await Drive.exists(secondResponse.avatar.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)
  })

  test('cleanup attachments when rollback is called after success', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        const isLocal = user.$isLocal

        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.useTransaction(trx).save()

        isLocal ? await trx.commit() : await trx.rollback()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const { body: secondResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isFalse(await Drive.exists(secondResponse.avatar.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)
  })
})

test.group('@responsiveAttachment | resetToNull', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {})
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.isNull(users[0].avatar)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)
  })

  test('do not remove old file when resetting to null fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null

        try {
          await user.save()
        } catch {}

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)

    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)
  })
})

test.group('@responsiveAttachment | resetToNull with transaction', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.useTransaction(trx).save()
        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.isNull(users[0].avatar)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)
  })

  test('do not remove old file when resetting to null fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null

        try {
          await user.useTransaction(trx).save()
          await trx.commit()
        } catch {
          await trx.rollback()
        }

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)

    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)
  })

  test('do not remove old file when rollback was performed after success', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        const isLocal = user.$isLocal
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null

        await user.useTransaction(trx).save()
        isLocal ? await trx.commit() : await trx.rollback()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)
  })
})

test.group('@responsiveAttachment | delete', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('delete attachment when model is deleted', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {})
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const user = await User.firstOrFail()
    await user.delete()

    const users = await User.all()
    assert.lengthOf(users, 0)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)
  })

  test('do not delete attachment when deletion fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    User.before('delete', () => {
      throw new Error('Failed')
    })

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {})
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const user = await User.firstOrFail()

    try {
      // Failing due to the `User.before('delete') hook`.
      // See above
      await user.delete()
    } catch (error) {}

    const users = await User.all()
    assert.lengthOf(users, 1)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), body.avatar)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })
})

test.group('@responsiveAttachment | delete with transaction', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('delete attachment when model is deleted', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {})
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const user = await User.firstOrFail()
    const trx = await Db.transaction()
    await user.useTransaction(trx).delete()

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size!
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size!
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)

    await trx.commit()

    const users = await User.all()
    assert.lengthOf(users, 0)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))
  })

  test('do not delete attachment when deletion fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    User.after('delete', () => {
      throw new Error('Failed')
    })

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {})
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const user = await User.firstOrFail()
    const trx = await Db.transaction()

    try {
      await user.useTransaction(trx).delete()
    } catch {
      assert.isTrue(await Drive.exists(body.avatar.name!))
      assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
      assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
      assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
      assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

      await trx.rollback()
    }

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), body.avatar)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })
})

test.group('@responsiveAttachment | find', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('pre-compute urls on find', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment({ preComputeUrls: true })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const user = await User.firstOrFail()

    assert.instanceOf(user.avatar, ResponsiveAttachment)

    assert.isDefined(user.avatar?.urls)
    assert.isUndefined(user.avatar?.breakpoints?.large.url)
    assert.isUndefined(user.avatar?.breakpoints?.medium.url)
    assert.isUndefined(user.avatar?.breakpoints?.small.url)
    assert.isUndefined(user.avatar?.breakpoints?.thumbnail.url)

    assert.isDefined(body.avatar.url)
    assert.isDefined(body.avatar?.breakpoints?.large.url)
    assert.isDefined(body.avatar?.breakpoints?.medium.url)
    assert.isDefined(body.avatar?.breakpoints?.small.url)
    assert.isDefined(body.avatar?.breakpoints?.thumbnail.url)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })

  test('do not pre-compute when preComputeUrls is not enabled', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const user = await User.firstOrFail()
    assert.instanceOf(user.avatar, ResponsiveAttachment)

    assert.isUndefined(user.avatar?.urls)
    assert.isUndefined(body.avatar.url)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })
})

test.group('@responsiveAttachment | fetch', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('pre-compute urls on fetch', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment({ preComputeUrls: true })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)

    assert.isDefined(users[0].avatar?.urls)
    assert.isUndefined(users[0].avatar?.breakpoints?.large.url)
    assert.isUndefined(users[0].avatar?.breakpoints?.medium.url)
    assert.isUndefined(users[0].avatar?.breakpoints?.small.url)
    assert.isUndefined(users[0].avatar?.breakpoints?.thumbnail.url)

    assert.isDefined(body.avatar.url)
    assert.isDefined(body.avatar?.breakpoints?.large.url)
    assert.isDefined(body.avatar?.breakpoints?.medium.url)
    assert.isDefined(body.avatar?.breakpoints?.small.url)
    assert.isDefined(body.avatar?.breakpoints?.thumbnail.url)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })

  test('do not pre-compute when preComputeUrls is not enabled', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.all()
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)

    assert.isUndefined(users[0].avatar?.urls)
    assert.isUndefined(body.avatar.url)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })
})

test.group('@responsiveAttachment | paginate', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('pre-compute urls on paginate', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment({ preComputeUrls: true })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.query().paginate(1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)

    assert.isDefined(users[0].avatar?.urls)
    assert.isUndefined(users[0].avatar?.breakpoints?.large.url)
    assert.isUndefined(users[0].avatar?.breakpoints?.medium.url)
    assert.isUndefined(users[0].avatar?.breakpoints?.small.url)
    assert.isUndefined(users[0].avatar?.breakpoints?.thumbnail.url)

    assert.isDefined(body.avatar.url)
    assert.isDefined(body.avatar?.breakpoints?.large.url)
    assert.isDefined(body.avatar?.breakpoints?.medium.url)
    assert.isDefined(body.avatar?.breakpoints?.small.url)
    assert.isDefined(body.avatar?.breakpoints?.thumbnail.url)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })

  test('do not pre-compute when preComputeUrls is not enabled', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const file = ctx.request.file('avatar')!

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = file ? await ResponsiveAttachment.fromFile(file) : null
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body }: AttachmentBody = await supertest(server)
      .post('/')
      .attach('avatar', join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg'))

    const users = await User.query().paginate(1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)

    assert.isUndefined(users[0].avatar?.urls)
    assert.isUndefined(body.avatar.url)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)
  })
})

test.group('@responsiveAttachment | fromBuffer | insert', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), body.avatar)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    await User.create({ username: 'ndianabasi' })

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)

        try {
          await user.save()
        } catch (error) {}

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.isNull(users[0].avatar)

    assert.isFalse(await Drive.exists(body.avatar.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })
})

test.group('@responsiveAttachment | fromBuffer | insert with transaction', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.useTransaction(trx).save()

        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), body.avatar)

    assert.isTrue(await Drive.exists(body.avatar.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    await User.create({ username: 'ndianabasi' })

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)

        try {
          await user.useTransaction(trx).save()
          await trx.commit()
        } catch (error) {
          await trx.rollback()
        }

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.isNull(users[0].avatar)

    assert.isFalse(await Drive.exists(body.avatar.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(body.avatar.breakpoints?.thumbnail.size! < body.avatar.breakpoints?.small.size!)
    assert.isTrue(body.avatar.breakpoints?.small.size! < body.avatar.breakpoints?.medium.size!)
    assert.isTrue(body.avatar.breakpoints?.medium.size! < body.avatar.breakpoints?.large.size!)
    assert.isTrue(body.avatar.breakpoints?.large.size! < body.avatar.size!)

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })

  test('cleanup attachments when rollback is called after success', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.useTransaction(trx).save()
        await trx.rollback()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 0)
    assert.isFalse(await Drive.exists(body.avatar.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(body.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(body.avatar.url)
    assert.notExists(body.avatar.breakpoints?.large.url)
    assert.notExists(body.avatar.breakpoints?.medium.url)
    assert.notExists(body.avatar.breakpoints?.small.url)
    assert.notExists(body.avatar.breakpoints?.thumbnail.url)
  })
})

test.group('@responsiveAttachment | fromBuffer | update', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {})
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.save()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse } = await supertest(server).post('/')

    const { body: secondResponse } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), secondResponse.avatar)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(await Drive.exists(secondResponse.avatar.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(secondResponse.avatar.url)
    assert.notExists(secondResponse.avatar.breakpoints?.large.url)
    assert.notExists(secondResponse.avatar.breakpoints?.medium.url)
    assert.notExists(secondResponse.avatar.breakpoints?.small.url)
    assert.notExists(secondResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      secondResponse.avatar.breakpoints?.thumbnail.size! <
        secondResponse.avatar.breakpoints?.small.size
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.small.size! <
        secondResponse.avatar.breakpoints?.medium.size
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.medium.size! <
        secondResponse.avatar.breakpoints?.large.size
    )
    assert.isTrue(secondResponse.avatar.breakpoints?.large.size! < secondResponse.avatar.size!)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)

        try {
          await user.save()
        } catch {}

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse } = await supertest(server).post('/')

    const { body: secondResponse } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isFalse(await Drive.exists(secondResponse.avatar.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)
  })
})

test.group('@responsiveAttachment | fromBuffer | update with transaction', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('save attachment to the db and on disk', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.save()
        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse } = await supertest(server).post('/')

    const { body: secondResponse } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), secondResponse.avatar)

    assert.isFalse(await Drive.exists(firstResponse.avatar.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isTrue(await Drive.exists(secondResponse.avatar.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(secondResponse.avatar.url)
    assert.notExists(secondResponse.avatar.breakpoints?.large.url)
    assert.notExists(secondResponse.avatar.breakpoints?.medium.url)
    assert.notExists(secondResponse.avatar.breakpoints?.small.url)
    assert.notExists(secondResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      secondResponse.avatar.breakpoints?.thumbnail.size! <
        secondResponse.avatar.breakpoints?.small.size
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.small.size! <
        secondResponse.avatar.breakpoints?.medium.size
    )
    assert.isTrue(
      secondResponse.avatar.breakpoints?.medium.size! <
        secondResponse.avatar.breakpoints?.large.size
    )
    assert.isTrue(secondResponse.avatar.breakpoints?.large.size! < secondResponse.avatar.size!)
  })

  test('cleanup attachments when save call fails', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = new User()
        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)

        try {
          await user.useTransaction(trx).save()
          await trx.commit()
        } catch {
          await trx.rollback()
        }

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse } = await supertest(server).post('/')

    const { body: secondResponse } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isFalse(await Drive.exists(secondResponse.avatar.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)
  })

  test('cleanup attachments when rollback is called after success', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment()
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        const isLocal = user.$isLocal

        user.username = 'ndianabasi'
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.useTransaction(trx).save()

        isLocal ? await trx.commit() : await trx.rollback()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: firstResponse } = await supertest(server).post('/')
    const { body: secondResponse } = await supertest(server).post('/')

    const users = await User.all()

    assert.lengthOf(users, 1)
    assert.instanceOf(users[0].avatar, ResponsiveAttachment)
    assert.deepNestedInclude(users[0].avatar?.toJSON(), firstResponse.avatar)

    assert.isTrue(await Drive.exists(firstResponse.avatar.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.large.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.medium.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.small.name!))
    assert.isTrue(await Drive.exists(firstResponse.avatar.breakpoints?.thumbnail.name!))

    assert.isFalse(await Drive.exists(secondResponse.avatar.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.large.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.medium.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.small.name!))
    assert.isFalse(await Drive.exists(secondResponse.avatar.breakpoints?.thumbnail.name!))

    assert.notExists(firstResponse.avatar.url)
    assert.notExists(firstResponse.avatar.breakpoints?.large.url)
    assert.notExists(firstResponse.avatar.breakpoints?.medium.url)
    assert.notExists(firstResponse.avatar.breakpoints?.small.url)
    assert.notExists(firstResponse.avatar.breakpoints?.thumbnail.url)

    assert.isTrue(
      firstResponse.avatar.breakpoints?.thumbnail.size! <
        firstResponse.avatar.breakpoints?.small.size
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.small.size! < firstResponse.avatar.breakpoints?.medium.size
    )
    assert.isTrue(
      firstResponse.avatar.breakpoints?.medium.size! < firstResponse.avatar.breakpoints?.large.size
    )
    assert.isTrue(firstResponse.avatar.breakpoints?.large.size! < firstResponse.avatar.size!)
  })
})

test.group('@responsiveAttachment | blurhash', (group) => {
  group.before(async () => {
    app = await setupApplication()
    await setup(app)

    app.container.resolveBinding('Adonis/Core/Route').commit()
    ResponsiveAttachment.setDrive(app.container.resolveBinding('Adonis/Core/Drive'))
    ResponsiveAttachment.setLogger(app.container.resolveBinding('Adonis/Core/Logger'))
  })

  group.afterEach(async () => {
    await app.container.resolveBinding('Adonis/Lucid/Database').connection().truncate('users')
  })

  group.after(async () => {
    await cleanup(app)
  })

  test('should create attachment with blurhash string in all responsive formats when enabled', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment({ blurhash: { enabled: true } })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.save()
        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    assert.isTrue(await Drive.exists(body.avatar.name))
    assert.isNotEmpty(body.avatar.blurhash)
    assert.isNotEmpty(body.avatar.breakpoints?.small.blurhash)
    assert.isNotEmpty(body.avatar.breakpoints?.large.blurhash)
    assert.isNotEmpty(body.avatar.breakpoints?.medium.blurhash)
    assert.isNotEmpty(body.avatar.breakpoints?.thumbnail.blurhash)
    // Check that blurhash is valid
    assert.isTrue(isBlurhashValid(body.avatar.blurhash).result)
    // All blurhashes should be the same
    assert.isTrue(
      body.avatar.blurhash === body.avatar.breakpoints?.small.blurhash &&
        body.avatar.blurhash === body.avatar.breakpoints?.medium.blurhash &&
        body.avatar.blurhash === body.avatar.breakpoints?.large.blurhash &&
        body.avatar.blurhash === body.avatar.breakpoints?.thumbnail.blurhash
    )

    const user = await User.firstOrFail()

    assert.isNotEmpty(user.avatar!.blurhash)
    assert.isNotEmpty(user.avatar!.breakpoints?.small.blurhash)
    assert.isNotEmpty(user.avatar!.breakpoints?.large.blurhash)
    assert.isNotEmpty(user.avatar!.breakpoints?.medium.blurhash)
    assert.isNotEmpty(user.avatar!.breakpoints?.thumbnail.blurhash)
  })

  test('should not create attachment with blurhash string in all responsive formats when disabled', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment({ blurhash: { enabled: false } })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/', {}, req, res)

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const buffer = await readFile(
          join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
        )
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.save()
        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body } = await supertest(server).post('/')

    assert.isTrue(await Drive.exists(body.avatar.name))
    assert.isUndefined(body.avatar.blurhash)
    assert.isUndefined(body.avatar.breakpoints?.small.blurhash)
    assert.isUndefined(body.avatar.breakpoints?.large.blurhash)
    assert.isUndefined(body.avatar.breakpoints?.medium.blurhash)
    assert.isUndefined(body.avatar.breakpoints?.thumbnail.blurhash)

    const user = await User.firstOrFail()

    assert.isUndefined(user.avatar!.blurhash)
    assert.isUndefined(user.avatar!.breakpoints?.small.blurhash)
    assert.isUndefined(user.avatar!.breakpoints?.large.blurhash)
    assert.isUndefined(user.avatar!.breakpoints?.medium.blurhash)
    assert.isUndefined(user.avatar!.breakpoints?.thumbnail.blurhash)
  })

  test('should maintain filenames of attachments when "persistentFileNames" is enabled', async (assert) => {
    const Drive = app.container.resolveBinding('Adonis/Core/Drive')
    const Db = app.container.resolveBinding('Adonis/Lucid/Database')
    const { column, BaseModel } = app.container.use('Adonis/Lucid/Orm')
    const HttpContext = app.container.resolveBinding('Adonis/Core/HttpContext')

    class User extends BaseModel {
      @column({ isPrimary: true })
      public id: string

      @column()
      public username: string

      @responsiveAttachment({ persistentFileNames: true, folder: '1/2/3' })
      public avatar: ResponsiveAttachmentContract | null
    }

    const server = createServer((req, res) => {
      const ctx = HttpContext.create('/1', {}, req, res)
      const ctx2 = HttpContext.create('/2', {}, req, res)

      const buffer = readFileSync(
        join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-1500x1000.jpg')
      )
      const buffer2 = readFileSync(
        join(__dirname, '../Statue-of-Sardar-Vallabhbhai-Patel-825x550.jpg')
      )

      app.container.make(BodyParserMiddleware).handle(ctx, async () => {
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer)
        await user.save()
        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })

      app.container.make(BodyParserMiddleware).handle(ctx2, async () => {
        const trx = await Db.transaction()

        const user = await User.firstOrNew({ username: 'ndianabasi' }, {}, { client: trx })
        user.avatar = await ResponsiveAttachment.fromBuffer(buffer2)
        await user.save()
        await trx.commit()

        ctx.response.send(user)
        ctx.response.finish()
      })
    })

    const { body: response1 } = await supertest(server).post('/1')

    assert.equal(response1.avatar.name!, '1/2/3/original.jpg')
    assert.equal(response1.avatar.breakpoints?.large.name!, '1/2/3/large.jpg')
    assert.equal(response1.avatar.breakpoints?.medium.name!, '1/2/3/medium.jpg')
    assert.equal(response1.avatar.breakpoints?.small.name!, '1/2/3/small.jpg')
    assert.equal(response1.avatar.breakpoints?.thumbnail.name!, '1/2/3/thumbnail.jpg')

    const { body: response2 } = await supertest(server).post('/2')

    assert.equal(response1.avatar.name!, response2.avatar.name)
    assert.equal(response1.avatar.breakpoints?.large.name, response2.avatar.breakpoints?.large.name)
    assert.equal(
      response1.avatar.breakpoints?.medium.name,
      response2.avatar.breakpoints?.medium.name
    )
    assert.equal(response1.avatar.breakpoints?.small.name, response2.avatar.breakpoints?.small.name)
    assert.equal(
      response1.avatar.breakpoints?.thumbnail.name,
      response2.avatar.breakpoints?.thumbnail.name
    )

    assert.isTrue(await Drive.exists(response2.avatar.name))
    assert.isTrue(await Drive.exists(response1.avatar.breakpoints?.large.name))
    assert.isTrue(await Drive.exists(response1.avatar.breakpoints?.medium.name))
    assert.isTrue(await Drive.exists(response1.avatar.breakpoints?.small.name))
    assert.isTrue(await Drive.exists(response1.avatar.breakpoints?.thumbnail.name))
  })
})
