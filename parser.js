const chrono = require('chrono-node');

function parseTaskInput(input, referenceDate = new Date()) {
  const original = input ? input.trim() : '';
  if (!original) {
    return {
      title: '',
      rawInput: '',
      dueDate: null,
      dueTime: null,
      hasSpecificTime: false,
      dueDateTime: null,
      priority: 'medium',
      extractedDetails: { dateText: '', priorityText: '' }
    };
  }

  let text = original;

  // 1. Detect and extract priority
  let priority = 'medium'; // default
  let priorityMatchedText = '';

  const priorityPatterns = [
    { regex: /\b(?:priority\s*:\s*|p:)(urgent|p1|high|important|medium|normal|p2|low|p3)\b/i, extract: (m) => m[1] },
    { regex: /(?:^|\s)!(urgent|high|medium|low|p1|p2|p3)\b/i, extract: (m) => m[1] },
    { regex: /,\s*(urgent|high|medium|low|p1|p2|p3|important)\b/i, extract: (m) => m[1] },
    { regex: /\b(urgent|asap|critical|high priority|important)\b/i, extract: () => 'high' },
    { regex: /\b(medium priority|moderate|normal priority)\b/i, extract: () => 'medium' },
    { regex: /\b(low priority|whenever|minor)\b/i, extract: () => 'low' },
    { regex: /\b(high|medium|low|p1|p2|p3)\b(?=$|\s)/i, extract: (m) => m[1] }
  ];

  for (const { regex, extract } of priorityPatterns) {
    const match = text.match(regex);
    if (match) {
      const rawP = extract(match).toLowerCase();
      if (['urgent', 'p1', 'high', 'asap', 'critical', 'important'].includes(rawP)) {
        priority = 'high';
      } else if (['medium', 'normal', 'p2', 'moderate'].includes(rawP)) {
        priority = 'medium';
      } else if (['low', 'p3', 'minor', 'whenever'].includes(rawP)) {
        priority = 'low';
      }
      priorityMatchedText = match[0].trim();
      text = text.replace(regex, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  // 2. Parse date & time using chrono-node
  const parsedDates = chrono.parse(text, referenceDate, { forwardDate: true });
  let dueDate = null;
  let dueTime = null;
  let hasSpecificTime = false;
  let dueDateTime = null;
  let dateMatchedText = '';

  if (parsedDates.length > 0) {
    const result = parsedDates[0];
    dateMatchedText = result.text;
    const start = result.start;

    hasSpecificTime = start.isCertain('hour');
    const dateObj = start.date();

    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    dueDate = `${y}-${m}-${d}`;

    if (hasSpecificTime) {
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const mins = String(dateObj.getMinutes()).padStart(2, '0');
      dueTime = `${hours}:${mins}`;
      dueDateTime = `${dueDate}T${dueTime}:00`;
    } else {
      dueDateTime = `${dueDate}T23:59:59`;
    }

    text = (text.substring(0, result.index) + text.substring(result.index + result.text.length))
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Clean trailing / leading prepositions & punctuation left over
  text = text.replace(/^(by|on|at|due|for|to)\s+/i, '')
             .replace(/\s+(by|on|at|due|for|to)$/i, '')
             .replace(/[,\-;!]+$/, '')
             .replace(/^[,\-;!]+/, '')
             .trim();

  if (!text) {
    text = original;
  }

  return {
    title: text,
    rawInput: original,
    dueDate,
    dueTime,
    hasSpecificTime,
    dueDateTime,
    priority,
    extractedDetails: {
      dateText: dateMatchedText,
      priorityText: priorityMatchedText
    }
  };
}

module.exports = { parseTaskInput };
