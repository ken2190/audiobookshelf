const express = require('express')
const Path = require('path')

const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')

const fs = require('../libs/fsExtra')
const date = require('../libs/dateAndTime')

const LibraryController = require('../controllers/LibraryController')
const UserController = require('../controllers/UserController')
const CollectionController = require('../controllers/CollectionController')
const PlaylistController = require('../controllers/PlaylistController')
const MeController = require('../controllers/MeController')
const BackupController = require('../controllers/BackupController')
const LibraryItemController = require('../controllers/LibraryItemController')
const SeriesController = require('../controllers/SeriesController')
const FileSystemController = require('../controllers/FileSystemController')
const AuthorController = require('../controllers/AuthorController')
const SessionController = require('../controllers/SessionController')
const PodcastController = require('../controllers/PodcastController')
const NotificationController = require('../controllers/NotificationController')
const EmailController = require('../controllers/EmailController')
const SearchController = require('../controllers/SearchController')
const CacheController = require('../controllers/CacheController')
const ToolsController = require('../controllers/ToolsController')
const RSSFeedController = require('../controllers/RSSFeedController')
const MiscController = require('../controllers/MiscController')

const BookFinder = require('../finders/BookFinder')
const AuthorFinder = require('../finders/AuthorFinder')
const PodcastFinder = require('../finders/PodcastFinder')
const MusicFinder = require('../finders/MusicFinder')

const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')

class ApiRouter {
  constructor(Server) {
    this.auth = Server.auth
    this.scanner = Server.scanner
    this.playbackSessionManager = Server.playbackSessionManager
    this.abMergeManager = Server.abMergeManager
    this.backupManager = Server.backupManager
    this.coverManager = Server.coverManager
    this.watcher = Server.watcher
    this.cacheManager = Server.cacheManager
    this.podcastManager = Server.podcastManager
    this.audioMetadataManager = Server.audioMetadataManager
    this.rssFeedManager = Server.rssFeedManager
    this.cronManager = Server.cronManager
    this.notificationManager = Server.notificationManager
    this.emailManager = Server.emailManager
    this.taskManager = Server.taskManager

    this.bookFinder = new BookFinder()
    this.authorFinder = new AuthorFinder()
    this.podcastFinder = new PodcastFinder()
    this.musicFinder = new MusicFinder()

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    //
    // Library Routes
    //
    this.router.post('/libraries', LibraryController.create.bind(this))
    this.router.get('/libraries', LibraryController.findAll.bind(this))
    this.router.get('/libraries/:id', LibraryController.middlewareNew.bind(this), LibraryController.findOne.bind(this))
    this.router.patch('/libraries/:id', LibraryController.middlewareNew.bind(this), LibraryController.update.bind(this))
    this.router.delete('/libraries/:id', LibraryController.middlewareNew.bind(this), LibraryController.delete.bind(this))

    this.router.get('/libraries/:id/items2', LibraryController.middlewareNew.bind(this), LibraryController.getLibraryItemsNew.bind(this))
    this.router.get('/libraries/:id/items', LibraryController.middleware.bind(this), LibraryController.getLibraryItems.bind(this))
    this.router.delete('/libraries/:id/issues', LibraryController.middlewareNew.bind(this), LibraryController.removeLibraryItemsWithIssues.bind(this))
    this.router.get('/libraries/:id/episode-downloads', LibraryController.middlewareNew.bind(this), LibraryController.getEpisodeDownloadQueue.bind(this))
    this.router.get('/libraries/:id/series', LibraryController.middleware.bind(this), LibraryController.getAllSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/series/:seriesId', LibraryController.middlewareNew.bind(this), LibraryController.getSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/collections', LibraryController.middlewareNew.bind(this), LibraryController.getCollectionsForLibrary.bind(this))
    this.router.get('/libraries/:id/playlists', LibraryController.middlewareNew.bind(this), LibraryController.getUserPlaylistsForLibrary.bind(this))
    this.router.get('/libraries/:id/personalized2', LibraryController.middlewareNew.bind(this), LibraryController.getUserPersonalizedShelves.bind(this))
    this.router.get('/libraries/:id/personalized', LibraryController.middleware.bind(this), LibraryController.getLibraryUserPersonalizedOptimal.bind(this))
    this.router.get('/libraries/:id/filterdata', LibraryController.middlewareNew.bind(this), LibraryController.getLibraryFilterData.bind(this))
    this.router.get('/libraries/:id/search', LibraryController.middleware.bind(this), LibraryController.search.bind(this))
    this.router.get('/libraries/:id/stats', LibraryController.middleware.bind(this), LibraryController.stats.bind(this))
    this.router.get('/libraries/:id/authors', LibraryController.middlewareNew.bind(this), LibraryController.getAuthors.bind(this))
    this.router.get('/libraries/:id/narrators', LibraryController.middlewareNew.bind(this), LibraryController.getNarrators.bind(this))
    this.router.patch('/libraries/:id/narrators/:narratorId', LibraryController.middlewareNew.bind(this), LibraryController.updateNarrator.bind(this))
    this.router.delete('/libraries/:id/narrators/:narratorId', LibraryController.middlewareNew.bind(this), LibraryController.removeNarrator.bind(this))
    this.router.get('/libraries/:id/matchall', LibraryController.middleware.bind(this), LibraryController.matchAll.bind(this))
    this.router.post('/libraries/:id/scan', LibraryController.middleware.bind(this), LibraryController.scan.bind(this))
    this.router.get('/libraries/:id/recent-episodes', LibraryController.middleware.bind(this), LibraryController.getRecentEpisodes.bind(this))
    this.router.get('/libraries/:id/opml', LibraryController.middleware.bind(this), LibraryController.getOPMLFile.bind(this))
    this.router.post('/libraries/order', LibraryController.reorder.bind(this))

    //
    // Item Routes
    //
    this.router.post('/items/batch/delete', LibraryItemController.batchDelete.bind(this))
    this.router.post('/items/batch/update', LibraryItemController.batchUpdate.bind(this))
    this.router.post('/items/batch/get', LibraryItemController.batchGet.bind(this))
    this.router.post('/items/batch/quickmatch', LibraryItemController.batchQuickMatch.bind(this))
    this.router.post('/items/batch/scan', LibraryItemController.batchScan.bind(this))

    this.router.get('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.findOne.bind(this))
    this.router.patch('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.update.bind(this))
    this.router.delete('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.delete.bind(this))
    this.router.get('/items/:id/download', LibraryItemController.middleware.bind(this), LibraryItemController.download.bind(this))
    this.router.patch('/items/:id/media', LibraryItemController.middleware.bind(this), LibraryItemController.updateMedia.bind(this))
    this.router.get('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.getCover.bind(this))
    this.router.post('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.uploadCover.bind(this))
    this.router.patch('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.updateCover.bind(this))
    this.router.delete('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.removeCover.bind(this))
    this.router.post('/items/:id/match', LibraryItemController.middleware.bind(this), LibraryItemController.match.bind(this))
    this.router.post('/items/:id/play', LibraryItemController.middleware.bind(this), LibraryItemController.startPlaybackSession.bind(this))
    this.router.post('/items/:id/play/:episodeId', LibraryItemController.middleware.bind(this), LibraryItemController.startEpisodePlaybackSession.bind(this))
    this.router.patch('/items/:id/tracks', LibraryItemController.middleware.bind(this), LibraryItemController.updateTracks.bind(this))
    this.router.post('/items/:id/scan', LibraryItemController.middleware.bind(this), LibraryItemController.scan.bind(this))
    this.router.get('/items/:id/tone-object', LibraryItemController.middleware.bind(this), LibraryItemController.getToneMetadataObject.bind(this))
    this.router.post('/items/:id/chapters', LibraryItemController.middleware.bind(this), LibraryItemController.updateMediaChapters.bind(this))
    this.router.get('/items/:id/ffprobe/:fileid', LibraryItemController.middleware.bind(this), LibraryItemController.getFFprobeData.bind(this))
    this.router.get('/items/:id/file/:fileid', LibraryItemController.middleware.bind(this), LibraryItemController.getLibraryFile.bind(this))
    this.router.delete('/items/:id/file/:fileid', LibraryItemController.middleware.bind(this), LibraryItemController.deleteLibraryFile.bind(this))
    this.router.get('/items/:id/file/:fileid/download', LibraryItemController.middleware.bind(this), LibraryItemController.downloadLibraryFile.bind(this))
    this.router.get('/items/:id/ebook/:fileid?', LibraryItemController.middleware.bind(this), LibraryItemController.getEBookFile.bind(this))
    this.router.patch('/items/:id/ebook/:fileid/status', LibraryItemController.middleware.bind(this), LibraryItemController.updateEbookFileStatus.bind(this))

    //
    // User Routes
    //
    this.router.post('/users', UserController.middleware.bind(this), UserController.create.bind(this))
    this.router.get('/users', UserController.middleware.bind(this), UserController.findAll.bind(this))
    this.router.get('/users/online', UserController.getOnlineUsers.bind(this))
    this.router.get('/users/:id', UserController.middleware.bind(this), UserController.findOne.bind(this))
    this.router.patch('/users/:id', UserController.middleware.bind(this), UserController.update.bind(this))
    this.router.delete('/users/:id', UserController.middleware.bind(this), UserController.delete.bind(this))

    this.router.get('/users/:id/listening-sessions', UserController.middleware.bind(this), UserController.getListeningSessions.bind(this))
    this.router.get('/users/:id/listening-stats', UserController.middleware.bind(this), UserController.getListeningStats.bind(this))

    //
    // Collection Routes
    //
    this.router.post('/collections', CollectionController.middleware.bind(this), CollectionController.create.bind(this))
    this.router.get('/collections', CollectionController.findAll.bind(this))
    this.router.get('/collections/:id', CollectionController.middleware.bind(this), CollectionController.findOne.bind(this))
    this.router.patch('/collections/:id', CollectionController.middleware.bind(this), CollectionController.update.bind(this))
    this.router.delete('/collections/:id', CollectionController.middleware.bind(this), CollectionController.delete.bind(this))
    this.router.post('/collections/:id/book', CollectionController.middleware.bind(this), CollectionController.addBook.bind(this))
    this.router.delete('/collections/:id/book/:bookId', CollectionController.middleware.bind(this), CollectionController.removeBook.bind(this))
    this.router.post('/collections/:id/batch/add', CollectionController.middleware.bind(this), CollectionController.addBatch.bind(this))
    this.router.post('/collections/:id/batch/remove', CollectionController.middleware.bind(this), CollectionController.removeBatch.bind(this))

    //
    // Playlist Routes
    //
    this.router.post('/playlists', PlaylistController.create.bind(this))
    this.router.get('/playlists', PlaylistController.findAllForUser.bind(this))
    this.router.get('/playlists/:id', PlaylistController.middleware.bind(this), PlaylistController.findOne.bind(this))
    this.router.patch('/playlists/:id', PlaylistController.middleware.bind(this), PlaylistController.update.bind(this))
    this.router.delete('/playlists/:id', PlaylistController.middleware.bind(this), PlaylistController.delete.bind(this))
    this.router.post('/playlists/:id/item', PlaylistController.middleware.bind(this), PlaylistController.addItem.bind(this))
    this.router.delete('/playlists/:id/item/:libraryItemId/:episodeId?', PlaylistController.middleware.bind(this), PlaylistController.removeItem.bind(this))
    this.router.post('/playlists/:id/batch/add', PlaylistController.middleware.bind(this), PlaylistController.addBatch.bind(this))
    this.router.post('/playlists/:id/batch/remove', PlaylistController.middleware.bind(this), PlaylistController.removeBatch.bind(this))
    this.router.post('/playlists/collection/:collectionId', PlaylistController.createFromCollection.bind(this))

    //
    // Current User Routes (Me)
    //
    this.router.get('/me', MeController.getCurrentUser.bind(this))
    this.router.get('/me/listening-sessions', MeController.getListeningSessions.bind(this))
    this.router.get('/me/listening-stats', MeController.getListeningStats.bind(this))
    this.router.get('/me/progress/:id/remove-from-continue-listening', MeController.removeItemFromContinueListening.bind(this))
    this.router.get('/me/progress/:id/:episodeId?', MeController.getMediaProgress.bind(this))
    this.router.patch('/me/progress/batch/update', MeController.batchUpdateMediaProgress.bind(this))
    this.router.patch('/me/progress/:id', MeController.createUpdateMediaProgress.bind(this))
    this.router.delete('/me/progress/:id', MeController.removeMediaProgress.bind(this))
    this.router.patch('/me/progress/:id/:episodeId', MeController.createUpdateEpisodeMediaProgress.bind(this))
    this.router.post('/me/item/:id/bookmark', MeController.createBookmark.bind(this))
    this.router.patch('/me/item/:id/bookmark', MeController.updateBookmark.bind(this))
    this.router.delete('/me/item/:id/bookmark/:time', MeController.removeBookmark.bind(this))
    this.router.patch('/me/password', MeController.updatePassword.bind(this))
    this.router.post('/me/sync-local-progress', MeController.syncLocalMediaProgress.bind(this)) // TODO: Deprecated. Removed from Android. Only used in iOS app now.
    this.router.get('/me/items-in-progress', MeController.getAllLibraryItemsInProgress.bind(this))
    this.router.get('/me/series/:id/remove-from-continue-listening', MeController.removeSeriesFromContinueListening.bind(this))
    this.router.get('/me/series/:id/readd-to-continue-listening', MeController.readdSeriesFromContinueListening.bind(this))

    //
    // Backup Routes
    //
    this.router.get('/backups', BackupController.middleware.bind(this), BackupController.getAll.bind(this))
    this.router.post('/backups', BackupController.middleware.bind(this), BackupController.create.bind(this))
    this.router.delete('/backups/:id', BackupController.middleware.bind(this), BackupController.delete.bind(this))
    this.router.get('/backups/:id/download', BackupController.middleware.bind(this), BackupController.download.bind(this))
    this.router.get('/backups/:id/apply', BackupController.middleware.bind(this), BackupController.apply.bind(this))
    this.router.post('/backups/upload', BackupController.middleware.bind(this), BackupController.upload.bind(this))

    //
    // File System Routes
    //
    this.router.get('/filesystem', FileSystemController.getPaths.bind(this))
    this.router.post('/filesystem/pathexists', FileSystemController.checkPathExists.bind(this))

    //
    // Author Routes
    //
    this.router.get('/authors/search', AuthorController.search.bind(this))
    this.router.get('/authors/:id', AuthorController.middleware.bind(this), AuthorController.findOne.bind(this))
    this.router.patch('/authors/:id', AuthorController.middleware.bind(this), AuthorController.update.bind(this))
    this.router.post('/authors/:id/match', AuthorController.middleware.bind(this), AuthorController.match.bind(this))
    this.router.get('/authors/:id/image', AuthorController.middleware.bind(this), AuthorController.getImage.bind(this))

    //
    // Series Routes
    //
    this.router.get('/series/search', SeriesController.search.bind(this))
    this.router.get('/series/:id', SeriesController.middleware.bind(this), SeriesController.findOne.bind(this))
    this.router.patch('/series/:id', SeriesController.middleware.bind(this), SeriesController.update.bind(this))

    //
    // Playback Session Routes
    //
    this.router.get('/sessions', SessionController.getAllWithUserData.bind(this))
    this.router.delete('/sessions/:id', SessionController.middleware.bind(this), SessionController.delete.bind(this))
    this.router.get('/sessions/open', SessionController.getOpenSessions.bind(this))
    this.router.post('/session/local', SessionController.syncLocal.bind(this))
    this.router.post('/session/local-all', SessionController.syncLocalSessions.bind(this))
    // TODO: Update these endpoints because they are only for open playback sessions
    this.router.get('/session/:id', SessionController.openSessionMiddleware.bind(this), SessionController.getOpenSession.bind(this))
    this.router.post('/session/:id/sync', SessionController.openSessionMiddleware.bind(this), SessionController.sync.bind(this))
    this.router.post('/session/:id/close', SessionController.openSessionMiddleware.bind(this), SessionController.close.bind(this))

    //
    // Podcast Routes
    //
    this.router.post('/podcasts', PodcastController.create.bind(this))
    this.router.post('/podcasts/feed', PodcastController.getPodcastFeed.bind(this))
    this.router.post('/podcasts/opml', PodcastController.getFeedsFromOPMLText.bind(this))
    this.router.get('/podcasts/:id/checknew', PodcastController.middleware.bind(this), PodcastController.checkNewEpisodes.bind(this))
    this.router.get('/podcasts/:id/downloads', PodcastController.middleware.bind(this), PodcastController.getEpisodeDownloads.bind(this))
    this.router.get('/podcasts/:id/clear-queue', PodcastController.middleware.bind(this), PodcastController.clearEpisodeDownloadQueue.bind(this))
    this.router.get('/podcasts/:id/search-episode', PodcastController.middleware.bind(this), PodcastController.findEpisode.bind(this))
    this.router.post('/podcasts/:id/download-episodes', PodcastController.middleware.bind(this), PodcastController.downloadEpisodes.bind(this))
    this.router.post('/podcasts/:id/match-episodes', PodcastController.middleware.bind(this), PodcastController.quickMatchEpisodes.bind(this))
    this.router.get('/podcasts/:id/episode/:episodeId', PodcastController.middleware.bind(this), PodcastController.getEpisode.bind(this))
    this.router.patch('/podcasts/:id/episode/:episodeId', PodcastController.middleware.bind(this), PodcastController.updateEpisode.bind(this))
    this.router.delete('/podcasts/:id/episode/:episodeId', PodcastController.middleware.bind(this), PodcastController.removeEpisode.bind(this))

    //
    // Notification Routes (Admin and up)
    //
    this.router.get('/notifications', NotificationController.middleware.bind(this), NotificationController.get.bind(this))
    this.router.patch('/notifications', NotificationController.middleware.bind(this), NotificationController.update.bind(this))
    this.router.get('/notificationdata', NotificationController.middleware.bind(this), NotificationController.getData.bind(this))
    this.router.get('/notifications/test', NotificationController.middleware.bind(this), NotificationController.fireTestEvent.bind(this))
    this.router.post('/notifications', NotificationController.middleware.bind(this), NotificationController.createNotification.bind(this))
    this.router.delete('/notifications/:id', NotificationController.middleware.bind(this), NotificationController.deleteNotification.bind(this))
    this.router.patch('/notifications/:id', NotificationController.middleware.bind(this), NotificationController.updateNotification.bind(this))
    this.router.get('/notifications/:id/test', NotificationController.middleware.bind(this), NotificationController.sendNotificationTest.bind(this))

    //
    // Email Routes (Admin and up)
    //
    this.router.get('/emails/settings', EmailController.middleware.bind(this), EmailController.getSettings.bind(this))
    this.router.patch('/emails/settings', EmailController.middleware.bind(this), EmailController.updateSettings.bind(this))
    this.router.post('/emails/test', EmailController.middleware.bind(this), EmailController.sendTest.bind(this))
    this.router.post('/emails/ereader-devices', EmailController.middleware.bind(this), EmailController.updateEReaderDevices.bind(this))
    this.router.post('/emails/send-ebook-to-device', EmailController.middleware.bind(this), EmailController.sendEBookToDevice.bind(this))

    //
    // Search Routes
    //
    this.router.get('/search/covers', SearchController.findCovers.bind(this))
    this.router.get('/search/books', SearchController.findBooks.bind(this))
    this.router.get('/search/podcast', SearchController.findPodcasts.bind(this))
    this.router.get('/search/authors', SearchController.findAuthor.bind(this))
    this.router.get('/search/chapters', SearchController.findChapters.bind(this))
    this.router.get('/search/tracks', SearchController.findMusicTrack.bind(this))

    //
    // Cache Routes (Admin and up)
    //
    this.router.post('/cache/purge', CacheController.purgeCache.bind(this))
    this.router.post('/cache/items/purge', CacheController.purgeItemsCache.bind(this))

    //
    // Tools Routes (Admin and up)
    //
    this.router.post('/tools/item/:id/encode-m4b', ToolsController.middleware.bind(this), ToolsController.encodeM4b.bind(this))
    this.router.delete('/tools/item/:id/encode-m4b', ToolsController.middleware.bind(this), ToolsController.cancelM4bEncode.bind(this))
    this.router.post('/tools/item/:id/embed-metadata', ToolsController.middleware.bind(this), ToolsController.embedAudioFileMetadata.bind(this))
    this.router.post('/tools/batch/embed-metadata', ToolsController.middleware.bind(this), ToolsController.batchEmbedMetadata.bind(this))

    // 
    // RSS Feed Routes (Admin and up)
    //
    this.router.post('/feeds/item/:itemId/open', RSSFeedController.middleware.bind(this), RSSFeedController.openRSSFeedForItem.bind(this))
    this.router.post('/feeds/collection/:collectionId/open', RSSFeedController.middleware.bind(this), RSSFeedController.openRSSFeedForCollection.bind(this))
    this.router.post('/feeds/series/:seriesId/open', RSSFeedController.middleware.bind(this), RSSFeedController.openRSSFeedForSeries.bind(this))
    this.router.post('/feeds/:id/close', RSSFeedController.middleware.bind(this), RSSFeedController.closeRSSFeed.bind(this))

    //
    // Misc Routes
    //
    this.router.post('/upload', MiscController.handleUpload.bind(this))
    this.router.get('/tasks', MiscController.getTasks.bind(this))
    this.router.patch('/settings', MiscController.updateServerSettings.bind(this))
    this.router.post('/authorize', MiscController.authorize.bind(this))
    this.router.get('/tags', MiscController.getAllTags.bind(this))
    this.router.post('/tags/rename', MiscController.renameTag.bind(this))
    this.router.delete('/tags/:tag', MiscController.deleteTag.bind(this))
    this.router.get('/genres', MiscController.getAllGenres.bind(this))
    this.router.post('/genres/rename', MiscController.renameGenre.bind(this))
    this.router.delete('/genres/:genre', MiscController.deleteGenre.bind(this))
    this.router.post('/validate-cron', MiscController.validateCronExpression.bind(this))
  }

  async getDirectories(dir, relpath, excludedDirs, level = 0) {
    try {
      const paths = await fs.readdir(dir)

      let dirs = await Promise.all(paths.map(async dirname => {
        const fullPath = Path.join(dir, dirname)
        const path = Path.join(relpath, dirname)

        const isDir = (await fs.lstat(fullPath)).isDirectory()
        if (isDir && !excludedDirs.includes(path) && dirname !== 'node_modules') {
          return {
            path,
            dirname,
            fullPath,
            level,
            dirs: level < 4 ? (await this.getDirectories(fullPath, path, excludedDirs, level + 1)) : []
          }
        } else {
          return false
        }
      }))
      dirs = dirs.filter(d => d)
      return dirs
    } catch (error) {
      Logger.error('Failed to readdir', dir, error)
      return []
    }
  }

  //
  // Helper Methods
  //
  userJsonWithItemProgressDetails(user, hideRootToken = false) {
    const json = user.toJSONForBrowser(hideRootToken)

    json.mediaProgress = json.mediaProgress.map(lip => {
      const libraryItem = Database.libraryItems.find(li => li.id === lip.libraryItemId)
      if (!libraryItem) {
        Logger.warn('[ApiRouter] Library item not found for users progress ' + lip.libraryItemId)
        lip.media = null
      } else {
        if (lip.episodeId) {
          const episode = libraryItem.mediaType === 'podcast' ? libraryItem.media.getEpisode(lip.episodeId) : null
          if (!episode) {
            Logger.warn(`[ApiRouter] Episode ${lip.episodeId} not found for user media progress, podcast: ${libraryItem.media.metadata.title}`)
            lip.media = null
          } else {
            lip.media = libraryItem.media.toJSONExpanded()
            lip.episode = episode.toJSON()
          }
        } else {
          lip.media = libraryItem.media.toJSONExpanded()
        }
      }
      return lip
    }).filter(lip => !!lip)

    return json
  }

  /**
   * Remove library item and associated entities
   * @param {string} mediaType 
   * @param {string} libraryItemId 
   * @param {string[]} mediaItemIds array of bookId or podcastEpisodeId
   */
  async handleDeleteLibraryItem(mediaType, libraryItemId, mediaItemIds) {
    // Remove media progress for this library item from all users
    const users = await Database.models.user.getOldUsers()
    for (const user of users) {
      for (const mediaProgress of user.getAllMediaProgressForLibraryItem(libraryItemId)) {
        await Database.removeMediaProgress(mediaProgress.id)
      }
    }

    // TODO: Remove open sessions for library item

    // Remove series if empty
    if (mediaType === 'book') {
      const bookSeries = await Database.models.bookSeries.findAll({
        where: {
          bookId: mediaItemIds[0]
        },
        include: {
          model: Database.models.series,
          include: {
            model: Database.models.book
          }
        }
      })
      for (const bs of bookSeries) {
        if (bs.series.books.length === 1) {
          await this.removeEmptySeries(bs.series)
        }
      }
    }

    // remove item from playlists
    const playlistsWithItem = await Database.models.playlist.getPlaylistsForMediaItemIds(mediaItemIds)
    for (const playlist of playlistsWithItem) {
      let numMediaItems = playlist.playlistMediaItems.length

      let order = 1
      // Remove items in playlist and re-order
      for (const playlistMediaItem of playlist.playlistMediaItems) {
        if (mediaItemIds.includes(playlistMediaItem.mediaItemId)) {
          await playlistMediaItem.destroy()
          numMediaItems--
        } else {
          if (playlistMediaItem.order !== order) {
            playlistMediaItem.update({
              order
            })
          }
          order++
        }
      }

      // If playlist is now empty then remove it
      const jsonExpanded = await playlist.getOldJsonExpanded()
      if (!numMediaItems) {
        Logger.info(`[ApiRouter] Playlist "${playlist.name}" has no more items - removing it`)
        await playlist.destroy()
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
      } else {
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
      }
    }

    // Close rss feed - remove from db and emit socket event
    await this.rssFeedManager.closeFeedForEntityId(libraryItemId)

    // purge cover cache
    await this.cacheManager.purgeCoverCache(libraryItemId)

    const itemMetadataPath = Path.join(global.MetadataPath, 'items', libraryItemId)
    if (await fs.pathExists(itemMetadataPath)) {
      Logger.debug(`[ApiRouter] Removing item metadata path "${itemMetadataPath}"`)
      await fs.remove(itemMetadataPath)
    }

    await Database.removeLibraryItem(libraryItemId)

    SocketAuthority.emitter('item_removed', {
      id: libraryItemId
    })
  }

  async checkRemoveEmptySeries(seriesToCheck, excludeLibraryItemId = null) {
    if (!seriesToCheck?.length) return

    for (const series of seriesToCheck) {
      const otherLibraryItemsInSeries = Database.libraryItems.filter(li => li.id !== excludeLibraryItemId && li.isBook && li.media.metadata.hasSeries(series.id))
      if (!otherLibraryItemsInSeries.length) {
        // Close open RSS feed for series
        await this.rssFeedManager.closeFeedForEntityId(series.id)
        Logger.info(`[ApiRouter] Series "${series.name}" is now empty. Removing series`)
        await Database.removeSeries(series.id)
        // TODO: Socket events for series?
      }
    }
  }

  async removeEmptySeries(series) {
    await this.rssFeedManager.closeFeedForEntityId(series.id)
    Logger.info(`[ApiRouter] Series "${series.name}" is now empty. Removing series`)
    await Database.removeSeries(series.id)
  }

  async getUserListeningSessionsHelper(userId) {
    const userSessions = await Database.getPlaybackSessions({ userId })
    return userSessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getAllSessionsWithUserData() {
    const sessions = await Database.getPlaybackSessions()
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    const minifiedUserObjects = await Database.models.user.getMinifiedUserObjects()
    return sessions.map(se => {
      return {
        ...se,
        user: minifiedUserObjects.find(u => u.id === se.userId) || null
      }
    })
  }

  async getUserListeningStatsHelpers(userId) {
    const today = date.format(new Date(), 'YYYY-MM-DD')

    const listeningSessions = await this.getUserListeningSessionsHelper(userId)
    const listeningStats = {
      totalTime: 0,
      items: {},
      days: {},
      dayOfWeek: {},
      today: 0,
      recentSessions: listeningSessions.slice(0, 10)
    }
    listeningSessions.forEach((s) => {
      let sessionTimeListening = s.timeListening
      if (typeof sessionTimeListening == 'string') {
        sessionTimeListening = Number(sessionTimeListening)
      }

      if (s.dayOfWeek) {
        if (!listeningStats.dayOfWeek[s.dayOfWeek]) listeningStats.dayOfWeek[s.dayOfWeek] = 0
        listeningStats.dayOfWeek[s.dayOfWeek] += sessionTimeListening
      }
      if (s.date && sessionTimeListening > 0) {
        if (!listeningStats.days[s.date]) listeningStats.days[s.date] = 0
        listeningStats.days[s.date] += sessionTimeListening

        if (s.date === today) {
          listeningStats.today += sessionTimeListening
        }
      }
      if (!listeningStats.items[s.libraryItemId]) {
        listeningStats.items[s.libraryItemId] = {
          id: s.libraryItemId,
          timeListening: sessionTimeListening,
          mediaMetadata: s.mediaMetadata,
          lastUpdate: s.lastUpdate
        }
      } else {
        listeningStats.items[s.libraryItemId].timeListening += sessionTimeListening
      }

      listeningStats.totalTime += sessionTimeListening
    })
    return listeningStats
  }

  async createAuthorsAndSeriesForItemUpdate(mediaPayload, libraryId) {
    if (mediaPayload.metadata) {
      const mediaMetadata = mediaPayload.metadata

      // Create new authors if in payload
      if (mediaMetadata.authors && mediaMetadata.authors.length) {
        const newAuthors = []
        for (let i = 0; i < mediaMetadata.authors.length; i++) {
          const authorName = (mediaMetadata.authors[i].name || '').trim()
          if (!authorName) {
            Logger.error(`[ApiRouter] Invalid author object, no name`, mediaMetadata.authors[i])
            continue
          }

          if (!mediaMetadata.authors[i].id || mediaMetadata.authors[i].id.startsWith('new')) {
            let author = Database.authors.find(au => au.libraryId === libraryId && au.checkNameEquals(authorName))
            if (!author) {
              author = new Author()
              author.setData(mediaMetadata.authors[i], libraryId)
              Logger.debug(`[ApiRouter] Created new author "${author.name}"`)
              newAuthors.push(author)
            }

            // Update ID in original payload
            mediaMetadata.authors[i].id = author.id
          }
        }
        if (newAuthors.length) {
          await Database.createBulkAuthors(newAuthors)
          SocketAuthority.emitter('authors_added', newAuthors.map(au => au.toJSON()))
        }
      }

      // Create new series if in payload
      if (mediaMetadata.series && mediaMetadata.series.length) {
        const newSeries = []
        for (let i = 0; i < mediaMetadata.series.length; i++) {
          const seriesName = (mediaMetadata.series[i].name || '').trim()
          if (!seriesName) {
            Logger.error(`[ApiRouter] Invalid series object, no name`, mediaMetadata.series[i])
            continue
          }

          if (!mediaMetadata.series[i].id || mediaMetadata.series[i].id.startsWith('new')) {
            let seriesItem = Database.series.find(se => se.libraryId === libraryId && se.checkNameEquals(seriesName))
            if (!seriesItem) {
              seriesItem = new Series()
              seriesItem.setData(mediaMetadata.series[i], libraryId)
              Logger.debug(`[ApiRouter] Created new series "${seriesItem.name}"`)
              newSeries.push(seriesItem)
            }

            // Update ID in original payload
            mediaMetadata.series[i].id = seriesItem.id
          }
        }
        if (newSeries.length) {
          await Database.createBulkSeries(newSeries)
          SocketAuthority.emitter('multiple_series_added', newSeries.map(se => se.toJSON()))
        }
      }
    }
  }
}
module.exports = ApiRouter
