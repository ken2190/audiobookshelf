const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const Playlist = require('../objects/Playlist')

class PlaylistController {
  constructor() { }

  /**
   * POST: /api/playlists
   * Create playlist
   * @param {*} req 
   * @param {*} res 
   */
  async create(req, res) {
    const oldPlaylist = new Playlist()
    req.body.userId = req.user.id
    const success = oldPlaylist.setData(req.body)
    if (!success) {
      return res.status(400).send('Invalid playlist request data')
    }

    // Create Playlist record
    const newPlaylist = await Database.models.playlist.createFromOld(oldPlaylist)

    // Lookup all library items in playlist
    const libraryItemIds = oldPlaylist.items.map(i => i.libraryItemId).filter(i => i)
    const libraryItemsInPlaylist = await Database.models.libraryItem.findAll({
      where: {
        id: libraryItemIds
      }
    })

    // Create playlistMediaItem records
    const mediaItemsToAdd = []
    let order = 1
    for (const mediaItemObj of oldPlaylist.items) {
      const libraryItem = libraryItemsInPlaylist.find(li => li.id === mediaItemObj.libraryItemId)
      if (!libraryItem) continue

      mediaItemsToAdd.push({
        mediaItemId: mediaItemObj.episodeId || libraryItem.mediaId,
        mediaItemType: mediaItemObj.episodeId ? 'podcastEpisode' : 'book',
        playlistId: oldPlaylist.id,
        order: order++
      })
    }
    if (mediaItemsToAdd.length) {
      await Database.createBulkPlaylistMediaItems(mediaItemsToAdd)
    }

    const jsonExpanded = await newPlaylist.getOldJsonExpanded()
    SocketAuthority.clientEmitter(newPlaylist.userId, 'playlist_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  /**
   * GET: /api/playlists
   * Get all playlists for user
   * @param {*} req 
   * @param {*} res 
   */
  async findAllForUser(req, res) {
    const playlistsForUser = await Database.models.playlist.findAll({
      where: {
        userId: req.user.id
      }
    })
    const playlists = []
    for (const playlist of playlistsForUser) {
      const jsonExpanded = await playlist.getOldJsonExpanded()
      playlists.push(jsonExpanded)
    }
    res.json({
      playlists
    })
  }

  /**
   * GET: /api/playlists/:id
   * @param {*} req 
   * @param {*} res 
   */
  async findOne(req, res) {
    const jsonExpanded = await req.playlist.getOldJsonExpanded()
    res.json(jsonExpanded)
  }

  /**
   * PATCH: /api/playlists/:id
   * Update playlist
   * @param {*} req 
   * @param {*} res 
   */
  async update(req, res) {
    const updatedPlaylist = req.playlist.set(req.body)
    let wasUpdated = false
    const changed = updatedPlaylist.changed()
    if (changed?.length) {
      await req.playlist.save()
      Logger.debug(`[PlaylistController] Updated playlist ${req.playlist.id} keys [${changed.join(',')}]`)
      wasUpdated = true
    }

    // If array of items is passed in then update order of playlist media items
    const libraryItemIds = req.body.items?.map(i => i.libraryItemId).filter(i => i) || []
    if (libraryItemIds.length) {
      const libraryItems = await Database.models.libraryItem.findAll({
        where: {
          id: libraryItemIds
        }
      })
      const existingPlaylistMediaItems = await updatedPlaylist.getPlaylistMediaItems({
        order: [['order', 'ASC']]
      })

      // Set an array of mediaItemId
      const newMediaItemIdOrder = []
      for (const item of req.body.items) {
        const libraryItem = libraryItems.find(li => li.id === item.libraryItemId)
        if (!libraryItem) {
          continue
        }
        const mediaItemId = item.episodeId || libraryItem.mediaId
        newMediaItemIdOrder.push(mediaItemId)
      }

      // Sort existing playlist media items into new order
      existingPlaylistMediaItems.sort((a, b) => {
        const aIndex = newMediaItemIdOrder.findIndex(i => i === a.mediaItemId)
        const bIndex = newMediaItemIdOrder.findIndex(i => i === b.mediaItemId)
        return aIndex - bIndex
      })

      // Update order on playlistMediaItem records
      let order = 1
      for (const playlistMediaItem of existingPlaylistMediaItems) {
        if (playlistMediaItem.order !== order) {
          await playlistMediaItem.update({
            order
          })
          wasUpdated = true
        }
        order++
      }
    }

    const jsonExpanded = await updatedPlaylist.getOldJsonExpanded()
    if (wasUpdated) {
      SocketAuthority.clientEmitter(updatedPlaylist.userId, 'playlist_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/playlists/:id
   * Remove playlist
   * @param {*} req 
   * @param {*} res 
   */
  async delete(req, res) {
    const jsonExpanded = await req.playlist.getOldJsonExpanded()
    await req.playlist.destroy()
    SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_removed', jsonExpanded)
    res.sendStatus(200)
  }

  /**
   * POST: /api/playlists/:id/item
   * Add item to playlist
   * @param {*} req 
   * @param {*} res 
   */
  async addItem(req, res) {
    const oldPlaylist = await Database.models.playlist.getById(req.playlist.id)
    const itemToAdd = req.body

    if (!itemToAdd.libraryItemId) {
      return res.status(400).send('Request body has no libraryItemId')
    }

    const libraryItem = await Database.models.libraryItem.getOldById(itemToAdd.libraryItemId)
    if (!libraryItem) {
      return res.status(400).send('Library item not found')
    }
    if (libraryItem.libraryId !== oldPlaylist.libraryId) {
      return res.status(400).send('Library item in different library')
    }
    if (oldPlaylist.containsItem(itemToAdd)) {
      return res.status(400).send('Item already in playlist')
    }
    if ((itemToAdd.episodeId && !libraryItem.isPodcast) || (libraryItem.isPodcast && !itemToAdd.episodeId)) {
      return res.status(400).send('Invalid item to add for this library type')
    }
    if (itemToAdd.episodeId && !libraryItem.media.checkHasEpisode(itemToAdd.episodeId)) {
      return res.status(400).send('Episode not found in library item')
    }

    const playlistMediaItem = {
      playlistId: oldPlaylist.id,
      mediaItemId: itemToAdd.episodeId || libraryItem.media.id,
      mediaItemType: itemToAdd.episodeId ? 'podcastEpisode' : 'book',
      order: oldPlaylist.items.length + 1
    }

    await Database.createPlaylistMediaItem(playlistMediaItem)
    const jsonExpanded = await req.playlist.getOldJsonExpanded()
    SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/playlists/:id/item/:libraryItemId/:episodeId?
   * Remove item from playlist
   * @param {*} req 
   * @param {*} res 
   */
  async removeItem(req, res) {
    const oldLibraryItem = await Database.models.libraryItem.getOldById(req.params.libraryItemId)
    if (!oldLibraryItem) {
      return res.status(404).send('Library item not found')
    }

    // Get playlist media items
    const mediaItemId = req.params.episodeId || oldLibraryItem.media.id
    const playlistMediaItems = await req.playlist.getPlaylistMediaItems({
      order: [['order', 'ASC']]
    })

    // Check if media item to delete is in playlist
    const mediaItemToRemove = playlistMediaItems.find(pmi => pmi.mediaItemId === mediaItemId)
    if (!mediaItemToRemove) {
      return res.status(404).send('Media item not found in playlist')
    }

    // Remove record
    await mediaItemToRemove.destroy()

    // Update playlist media items order
    let order = 1
    for (const mediaItem of playlistMediaItems) {
      if (mediaItem.mediaItemId === mediaItemId) continue
      if (mediaItem.order !== order) {
        await mediaItem.update({
          order
        })
      }
      order++
    }

    const jsonExpanded = await req.playlist.getOldJsonExpanded()

    // Playlist is removed when there are no items
    if (!jsonExpanded.items.length) {
      Logger.info(`[PlaylistController] Playlist "${jsonExpanded.name}" has no more items - removing it`)
      await req.playlist.destroy()
      SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_removed', jsonExpanded)
    } else {
      SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_updated', jsonExpanded)
    }

    res.json(jsonExpanded)
  }

  /**
   * POST: /api/playlists/:id/batch/add
   * Batch add playlist items
   * @param {*} req 
   * @param {*} res 
   */
  async addBatch(req, res) {
    if (!req.body.items?.length) {
      return res.status(400).send('Invalid request body')
    }
    const itemsToAdd = req.body.items

    const libraryItemIds = itemsToAdd.map(i => i.libraryItemId).filter(i => i)
    if (!libraryItemIds.length) {
      return res.status(400).send('Invalid request body')
    }

    // Find all library items
    const libraryItems = await Database.models.libraryItem.findAll({
      where: {
        id: libraryItemIds
      }
    })

    // Get all existing playlist media items
    const existingPlaylistMediaItems = await req.playlist.getPlaylistMediaItems({
      order: [['order', 'ASC']]
    })

    const mediaItemsToAdd = []

    // Setup array of playlistMediaItem records to add
    let order = existingPlaylistMediaItems.length + 1
    for (const item of itemsToAdd) {
      const libraryItem = libraryItems.find(li => li.id === item.libraryItemId)
      if (!libraryItem) {
        return res.status(404).send('Item not found with id ' + item.libraryItemId)
      } else {
        const mediaItemId = item.episodeId || libraryItem.mediaId
        if (existingPlaylistMediaItems.some(pmi => pmi.mediaItemId === mediaItemId)) {
          // Already exists in playlist
          continue
        } else {
          mediaItemsToAdd.push({
            playlistId: req.playlist.id,
            mediaItemId,
            mediaItemType: item.episodeId ? 'podcastEpisode' : 'book',
            order: order++
          })
        }
      }
    }

    let jsonExpanded = null
    if (mediaItemsToAdd.length) {
      await Database.createBulkPlaylistMediaItems(mediaItemsToAdd)
      jsonExpanded = await req.playlist.getOldJsonExpanded()
      SocketAuthority.clientEmitter(req.playlist.userId, 'playlist_updated', jsonExpanded)
    } else {
      jsonExpanded = await req.playlist.getOldJsonExpanded()
    }
    res.json(jsonExpanded)
  }

  /**
   * POST: /api/playlists/:id/batch/remove
   * Batch remove playlist items
   * @param {*} req 
   * @param {*} res 
   */
  async removeBatch(req, res) {
    if (!req.body.items?.length) {
      return res.status(400).send('Invalid request body')
    }

    const itemsToRemove = req.body.items
    const libraryItemIds = itemsToRemove.map(i => i.libraryItemId).filter(i => i)
    if (!libraryItemIds.length) {
      return res.status(400).send('Invalid request body')
    }

    // Find all library items
    const libraryItems = await Database.models.libraryItem.findAll({
      where: {
        id: libraryItemIds
      }
    })

    // Get all existing playlist media items for playlist
    const existingPlaylistMediaItems = await req.playlist.getPlaylistMediaItems({
      order: [['order', 'ASC']]
    })
    let numMediaItems = existingPlaylistMediaItems.length

    // Remove playlist media items
    let hasUpdated = false
    for (const item of itemsToRemove) {
      const libraryItem = libraryItems.find(li => li.id === item.libraryItemId)
      if (!libraryItem) continue
      const mediaItemId = item.episodeId || libraryItem.mediaId
      const existingMediaItem = existingPlaylistMediaItems.find(pmi => pmi.mediaItemId === mediaItemId)
      if (!existingMediaItem) continue
      await existingMediaItem.destroy()
      hasUpdated = true
      numMediaItems--
    }

    const jsonExpanded = await req.playlist.getOldJsonExpanded()
    if (hasUpdated) {
      // Playlist is removed when there are no items
      if (!numMediaItems) {
        Logger.info(`[PlaylistController] Playlist "${req.playlist.name}" has no more items - removing it`)
        await req.playlist.destroy()
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
      } else {
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
      }
    }
    res.json(jsonExpanded)
  }

  /**
   * POST: /api/playlists/collection/:collectionId
   * Create a playlist from a collection
   * @param {*} req 
   * @param {*} res 
   */
  async createFromCollection(req, res) {
    const collection = await Database.models.collection.findByPk(req.params.collectionId)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
    // Expand collection to get library items
    const collectionExpanded = await collection.getOldJsonExpanded(req.user)
    if (!collectionExpanded) {
      // This can happen if the user has no access to all items in collection
      return res.status(404).send('Collection not found')
    }

    // Playlists cannot be empty
    if (!collectionExpanded.books.length) {
      return res.status(400).send('Collection has no books')
    }

    const oldPlaylist = new Playlist()
    oldPlaylist.setData({
      userId: req.user.id,
      libraryId: collection.libraryId,
      name: collection.name,
      description: collection.description || null
    })

    // Create Playlist record
    const newPlaylist = await Database.models.playlist.createFromOld(oldPlaylist)

    // Create PlaylistMediaItem records
    const mediaItemsToAdd = []
    let order = 1
    for (const libraryItem of collectionExpanded.books) {
      mediaItemsToAdd.push({
        playlistId: newPlaylist.id,
        mediaItemId: libraryItem.media.id,
        mediaItemType: 'book',
        order: order++
      })
    }
    await Database.createBulkPlaylistMediaItems(mediaItemsToAdd)

    const jsonExpanded = await newPlaylist.getOldJsonExpanded()
    SocketAuthority.clientEmitter(newPlaylist.userId, 'playlist_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  async middleware(req, res, next) {
    if (req.params.id) {
      const playlist = await Database.models.playlist.findByPk(req.params.id)
      if (!playlist) {
        return res.status(404).send('Playlist not found')
      }
      if (playlist.userId !== req.user.id) {
        Logger.warn(`[PlaylistController] Playlist ${req.params.id} requested by user ${req.user.id} that is not the owner`)
        return res.sendStatus(403)
      }
      req.playlist = playlist
    }

    next()
  }
}
module.exports = new PlaylistController()