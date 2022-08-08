import * as dotenv from 'dotenv'
import cron from 'node-cron'
import { TwitterApi } from 'twitter-api-v2'

// env
dotenv.config()
const twitterClient = new TwitterApi({
  appKey: process.env.CONSUMER_KEY!,
  appSecret: process.env.CONSUMER_SECRET!,
  accessToken: process.env.ACCESS_TOKEN!,
  accessSecret: process.env.ACCESS_TOKEN_SECRET!,
})
// Tell typescript it's a readonly app
const roClient = twitterClient.readOnly

// TODO: Internal for AUTHORIZED_AUTHORS
const getIDuser = async (name: string | string[]) => {
  try {
    const { data } = await roClient.v2.usersByUsernames(name)
    return data
  } catch (error) {
    console.error(error)
    return null
  }
}

// TODO: only authorized accounts on Discord
const AUTHORIZED_AUTHORS = ['43547119', '386814786', '2903557745', '95005551']
const authUserList = async () => {
  try {
    const { data } = await roClient.v2.users(AUTHORIZED_AUTHORS)
    return data.map(el => ({
      id: el.id,
      username: `@${el.username}`,
      fullUsername: `@${el.username} <${el.name}>`,
    }))
  } catch (error) {
    console.error(error)
    return null
  }
}

// TODO: search for tweets tagged
const searchTag = async () => {
  try {
    const { data } = await roClient.v2.search('#BRFursTeam', {
      'tweet.fields': ['author_id', 'created_at'],
    })
    return data.data.filter(el => AUTHORIZED_AUTHORS.includes(el.author_id!))
  } catch (error) {
    console.error(error)
    return []
  }
}

const main = async () => {
  try {
    const date = new Date(new Date().setHours(0, 0, 0, 0))
    console.info('')
    console.info(`Date: ${date.toLocaleDateString('pt-BR')} (dd/mm/yyyy)`)
    console.info('BRFurs - TwitterBot - v1')
    console.info('----------')

    const userAuth = await authUserList()
    if (userAuth) {
      const listUserName = userAuth.map(el => el.fullUsername)
      console.info(`Authorized users: ${listUserName.join(', ')}`)
    } else {
      console.error('Users not found.')
      process.exit(-1)
    }

    console.info('')
    console.info('Checking recent tweets... (7days)')
    const foundTweets = await searchTag()
    console.log(`found: ${foundTweets.length}`)
    if (foundTweets.length > 0) {
      console.info('')
      const arrTweetsID = foundTweets.map(el => ({
        id: el.id,
        dayDate: new Date(new Date(el.created_at!).setHours(0, 0, 0, 0)),
        author: userAuth.find(item => item.id === el.author_id),
      }))

      // TODO: my account (.env)
      const me = await roClient.currentUser()

      // TODO: take all tweets and try to retweet 1 by 1
      for (let i = 0; i < arrTweetsID.length; i++) {
        const el = arrTweetsID[i]
        console.info(
          `[${i + 1}]: checking tweet from ${el.author?.username}...`
        )

        if (el.dayDate !== date) {
          console.info(
            `twitter not done on ${date.toLocaleDateString('pt-BR')}, skip...`
          )
        } else {
          // TODO: retweeting on my account (.env)
          const { data } = await twitterClient.v2.retweet(me.id_str, el.id)
          if (data.retweeted) {
            console.info('Successfully retweeted.')
          } else {
            console.info('retweeted already done, skip...')
          }
        }
      }
    }
  } catch (error) {
    console.info('----------')
    console.error(error)
  } finally {
    console.info('')
    console.info('--------------------')
  }
}

if (process.env.NODE_ENV === 'production') {
  // call 15min
  cron.schedule('0 */15 * * * *', async () => {
    try {
      await main()
    } catch (error) {
      console.log(error)
      process.exit(-1)
    }
  })
} else {
  // call 1min
  cron.schedule('* * * * *', async () => {
    try {
      console.log(await getIDuser('FineekoPotara'))
      // await main()
    } catch (error) {
      console.log(error)
      process.exit(-1)
    }
  })
}
