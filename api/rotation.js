/**
 * UTC-aligned book rotation.
 * Each group rotates once per UTC day at its configured hour.
 * No on-demand rotation — rotation only happens when the UTC day/hour passes.
 */

function shouldRotate(group) {
  const now = new Date();
  const currentUtcDay = now.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  const currentUtcHour = now.getUTCHours();

  // First time or new UTC day → rotate
  if (group.last_rotated_utc_day !== currentUtcDay) {
    return true;
  }

  // Same day, but haven't rotated at this hour yet
  if (currentUtcHour >= group.rotation_utc_hour && group.last_rotated_utc_day === currentUtcDay) {
    // Check if we already rotated at this hour today
    const todayKey = `${currentUtcDay}-${group.rotation_utc_hour}`;
    const lastRotationKey = `${group.last_rotated_utc_day}-${group.rotation_utc_hour}`;
    return todayKey !== lastRotationKey;
  }

  return false;
}

function rotateBooks(db) {
  const groups = db.exec('SELECT * FROM groups').all?.() || db.exec('SELECT * FROM groups');

  // Normalize: sql.js exec returns array of result objects, each with values
  const groupRows = Array.isArray(groups) && groups[0]
    ? groups[0].values.map(row => ({
        id: row[0],
        name: row[1],
        current_book_id: row[2],
        book_selected_at: row[3],
        last_rotated_utc_day: row[4],
        rotation_utc_hour: row[5],
      }))
    : [];

  const now = new Date();
  const currentUtcDay = now.toISOString().slice(0, 10);
  const currentUtcHour = now.getUTCHours();

  for (const group of groupRows) {
    const hour = group.rotation_utc_hour ?? 0;

    if (currentUtcHour < hour) continue;

    const alreadyRotatedToday = group.last_rotated_utc_day === currentUtcDay;
    if (alreadyRotatedToday) continue;

    // Pick a random book that's not the current one
    const candidates = db.exec(
      `SELECT id FROM books WHERE genre = '${group.id}' AND id != '${group.current_book_id || ''}' ORDER BY RANDOM() LIMIT 20`
    );

    let chosenId = null;
    if (candidates.length && candidates[0].values.length) {
      chosenId = candidates[0].values[0][0];
    } else {
      // Fallback: any book in genre
      const fallback = db.exec(
        `SELECT id FROM books WHERE genre = '${group.id}' ORDER BY RANDOM() LIMIT 1`
      );
      if (fallback.length && fallback[0].values.length) {
        chosenId = fallback[0].values[0][0];
      }
    }

    if (!chosenId) continue;

    db.exec(
      `UPDATE groups SET current_book_id = '${chosenId}', book_selected_at = datetime('now'), last_rotated_utc_day = '${currentUtcDay}', rotation_utc_hour = ${hour} WHERE id = '${group.id}'`
    );
  }
}

module.exports = { rotateBooks };
