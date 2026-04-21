function rotateBooks(db) {
  const groups = db.prepare('SELECT * FROM groups').all();

  for (const group of groups) {
    const needsRotation = !group.current_book_id || !group.book_selected_at;

    if (!needsRotation) {
      const hoursSinceSelection = (Date.now() - new Date(group.book_selected_at + 'Z').getTime()) / 3600000;
      if (hoursSinceSelection < group.rotation_interval_hours) continue;
    }

    const availableBooks = db.prepare(
      'SELECT * FROM books WHERE genre = ? AND id != ? ORDER BY RANDOM() LIMIT 20'
    ).all(group.genre, group.current_book_id || '');

    if (availableBooks.length === 0) {
      const anyBooks = db.prepare(
        'SELECT * FROM books WHERE genre = ? ORDER BY RANDOM() LIMIT 1'
      ).get(group.genre);
      if (!anyBooks) continue;

      db.prepare("UPDATE groups SET current_book_id = ?, book_selected_at = datetime('now') WHERE id = ?")
        .run(anyBooks.id, group.id);
    } else {
      const chosen = availableBooks[0];
      db.prepare("UPDATE groups SET current_book_id = ?, book_selected_at = datetime('now') WHERE id = ?")
        .run(chosen.id, group.id);
    }
  }
}

module.exports = { rotateBooks };
