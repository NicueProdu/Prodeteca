import { getSession } from './auth.js'

getSession().then(session => {
  window.location.href = session ? '/predictions' : '/login'
})
