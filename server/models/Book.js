const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')

module.exports = (sequelize) => {
  class Book extends Model {
    static getOldBook(libraryItemExpanded) {
      const bookExpanded = libraryItemExpanded.media
      let authors = []
      if (bookExpanded.authors?.length) {
        authors = bookExpanded.authors.map(au => {
          return {
            id: au.id,
            name: au.name
          }
        })
      } else if (bookExpanded.bookAuthors?.length) {
        authors = bookExpanded.bookAuthors.map(ba => {
          if (ba.author) {
            return {
              id: ba.author.id,
              name: ba.author.name
            }
          } else {
            Logger.error(`[Book] Invalid bookExpanded bookAuthors: no author`, ba)
            return null
          }
        }).filter(a => a)
      }

      let series = []
      if (bookExpanded.series?.length) {
        series = bookExpanded.series.map(se => {
          return {
            id: se.id,
            name: se.name,
            sequence: se.bookSeries.sequence
          }
        })
      } else if (bookExpanded.bookSeries?.length) {
        series = bookExpanded.bookSeries.map(bs => {
          if (bs.series) {
            return {
              id: bs.series.id,
              name: bs.series.name,
              sequence: bs.sequence
            }
          } else {
            Logger.error(`[Book] Invalid bookExpanded bookSeries: no series`, bs)
            return null
          }
        }).filter(s => s)
      }

      return {
        id: bookExpanded.id,
        libraryItemId: libraryItemExpanded.id,
        coverPath: bookExpanded.coverPath,
        tags: bookExpanded.tags,
        audioFiles: bookExpanded.audioFiles,
        chapters: bookExpanded.chapters,
        ebookFile: bookExpanded.ebookFile,
        metadata: {
          title: bookExpanded.title,
          subtitle: bookExpanded.subtitle,
          authors: authors,
          narrators: bookExpanded.narrators,
          series: series,
          genres: bookExpanded.genres,
          publishedYear: bookExpanded.publishedYear,
          publishedDate: bookExpanded.publishedDate,
          publisher: bookExpanded.publisher,
          description: bookExpanded.description,
          isbn: bookExpanded.isbn,
          asin: bookExpanded.asin,
          language: bookExpanded.language,
          explicit: bookExpanded.explicit,
          abridged: bookExpanded.abridged
        }
      }
    }

    /**
     * @param {object} oldBook 
     * @returns {boolean} true if updated
     */
    static saveFromOld(oldBook) {
      const book = this.getFromOld(oldBook)
      return this.update(book, {
        where: {
          id: book.id
        }
      }).then(result => result[0] > 0).catch((error) => {
        Logger.error(`[Book] Failed to save book ${book.id}`, error)
        return false
      })
    }

    static getFromOld(oldBook) {
      return {
        id: oldBook.id,
        title: oldBook.metadata.title,
        titleIgnorePrefix: oldBook.metadata.titleIgnorePrefix,
        subtitle: oldBook.metadata.subtitle,
        publishedYear: oldBook.metadata.publishedYear,
        publishedDate: oldBook.metadata.publishedDate,
        publisher: oldBook.metadata.publisher,
        description: oldBook.metadata.description,
        isbn: oldBook.metadata.isbn,
        asin: oldBook.metadata.asin,
        language: oldBook.metadata.language,
        explicit: !!oldBook.metadata.explicit,
        abridged: !!oldBook.metadata.abridged,
        narrators: oldBook.metadata.narrators,
        ebookFile: oldBook.ebookFile?.toJSON() || null,
        coverPath: oldBook.coverPath,
        duration: oldBook.duration,
        audioFiles: oldBook.audioFiles?.map(af => af.toJSON()) || [],
        chapters: oldBook.chapters,
        tags: oldBook.tags,
        genres: oldBook.metadata.genres
      }
    }
  }

  Book.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: DataTypes.STRING,
    titleIgnorePrefix: DataTypes.STRING,
    subtitle: DataTypes.STRING,
    publishedYear: DataTypes.STRING,
    publishedDate: DataTypes.STRING,
    publisher: DataTypes.STRING,
    description: DataTypes.TEXT,
    isbn: DataTypes.STRING,
    asin: DataTypes.STRING,
    language: DataTypes.STRING,
    explicit: DataTypes.BOOLEAN,
    abridged: DataTypes.BOOLEAN,
    coverPath: DataTypes.STRING,
    duration: DataTypes.FLOAT,

    narrators: DataTypes.JSON,
    audioFiles: DataTypes.JSON,
    ebookFile: DataTypes.JSON,
    chapters: DataTypes.JSON,
    tags: DataTypes.JSON,
    genres: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'book',
    indexes: [
      {
        fields: [{
          name: 'title',
          collate: 'NOCASE'
        }]
      },
      {
        fields: [{
          name: 'titleIgnorePrefix',
          collate: 'NOCASE'
        }]
      },
      {
        fields: ['publishedYear']
      },
      {
        fields: ['duration']
      }
    ]
  })

  return Book
}