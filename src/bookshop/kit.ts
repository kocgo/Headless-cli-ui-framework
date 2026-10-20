import { declare, type Services } from '../framework/index.js'
import { createApi, type Api } from './api.js'

/** What every data, model and action function receives. */
export interface ShopContext {
  api: Api
  log: Services['log']
}

export const createContext = ({ db, log }: Services): ShopContext => ({ api: createApi(db), log })

export const { page, layout, action, actions } = declare<ShopContext>()
