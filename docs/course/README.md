# Mini ECU Academy (course website)

An interactive course generated from this repository's real source code.

```
node docs/course/build.js        # -> docs/course/dist/mini-ecu-course.html (one self-contained file)
```

- `content/*.js`: the lessons, one file per group of chapters, loaded in file-name order.
- `app.html`: the website shell (navigation, code viewer, figures, widgets, quiz, flashcards).
- `build.js`: embeds the source files, extracts `#include` and caller relations, resolves every
  code reference and fails on any broken anchor, file link, lesson link or quiz answer.

Code references are text anchors (`from`, `to` or `n`, `hl`, `ex`), never fixed line numbers, so
line numbers follow the code automatically. When the code changes and an anchor disappears, the
build stops and names the lesson to update. In lesson text, `⟦x⟧` is inline code, `[[6.1.1]]`
links a lesson and `{{path@anchor}}` links a source line.
