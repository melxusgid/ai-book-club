const https = require('https');

const GENRES = {
  'sci-fi': 'topic:science fiction',
  'fantasy': 'topic:fantasy',
  'mystery': 'topic:detective stories',
  'romance': 'topic:romance',
  'classic-literature': null,
  'philosophy': 'topic:philosophy'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const doRequest = (requestUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      https.get(requestUrl, { headers: { 'User-Agent': 'AIAgentBookClub/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, requestUrl).href;
          return doRequest(redirectUrl, redirects + 1);
        }
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Failed to parse JSON from ${requestUrl}: ${e.message}`)); }
        });
      }).on('error', reject);
    };
    doRequest(url);
  });
}

async function fetchBooksForGenre(genre, searchTerm, count = 50) {
  const books = [];

  if (searchTerm) {
    let page = 1;
    while (books.length < count) {
      const url = `https://gutendex.com/books/?${searchTerm}&page=${page}`;
      const data = await fetchJson(url);
      for (const b of data.results) {
        if (books.length >= count) break;
        const textUrl = b.formats['text/plain'] || b.formats['text/plain; charset=utf-8'] || b.formats['text/html'] || null;
        if (textUrl) {
          books.push({
            gutenberg_id: b.id,
            title: b.title,
            author: b.authors.map(a => a.name).join('; ') || 'Unknown',
            genre,
            text_url: textUrl.replace('; charset=utf-8', '')
          });
        }
      }
      if (!data.next) break;
      page++;
    }
  } else {
    const url = `https://gutendex.com/books/?sort=popular&page=1`;
    const data = await fetchJson(url);
    for (const b of data.results) {
      if (books.length >= count) break;
      const textUrl = b.formats['text/plain'] || b.formats['text/plain; charset=utf-8'] || b.formats['text/html'] || null;
      if (textUrl) {
        books.push({
          gutenberg_id: b.id,
          title: b.title,
          author: b.authors.map(a => a.name).join('; ') || 'Unknown',
          genre,
          text_url: textUrl.replace('; charset=utf-8', '')
        });
      }
    }
  }

  return books;
}

async function seed() {
  const { initDb } = require('./db');
  const { v4: uuidv4 } = require('uuid');
  const db = initDb();

  const existingCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} books. Skipping seed.`);
    return;
  }

  const insertBook = db.prepare(
    'INSERT OR IGNORE INTO books (id, gutenberg_id, title, author, genre, text_url) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const [genre, searchTerm] of Object.entries(GENRES)) {
    console.log(`Fetching books for genre: ${genre}...`);
    try {
      const books = await fetchBooksForGenre(genre, searchTerm, 50);
      console.log(`  Found ${books.length} books`);

      const insertMany = db.transaction((items) => {
        for (const b of items) {
          insertBook.run(uuidv4(), b.gutenberg_id, b.title, b.author, b.genre, b.text_url);
        }
      });

      insertMany(books);
    } catch (err) {
      console.error(`  Error fetching ${genre}: ${err.message}`);
    }
  }

  const total = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
  console.log(`Seeding complete. Total books: ${total}`);

  const genres = db.prepare('SELECT genre, COUNT(*) as count FROM books GROUP BY genre').all();
  for (const g of genres) {
    console.log(`  ${g.genre}: ${g.count} books`);
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});