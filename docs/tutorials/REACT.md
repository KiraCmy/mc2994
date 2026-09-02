# React 101

A simple guide for people who have never used React.

You should be comfortable with **HTML tags**, a little **CSS**, and the idea that JavaScript can change a page. You do not need to be a JavaScript expert. If a JS word is new, there is a glossary below.

---

## What problem does this solve?

A plain website is a stack of HTML files. When the user clicks something, you hunt for elements and rewrite the page by hand (`document.getElementById`, innerHTML, and so on). That gets messy fast.

**React** is a JavaScript library for building **user interfaces**. You describe the screen as small pieces called **components**. When data changes, React updates the matching pieces instead of you rewriting the whole page.

Typical uses: dashboards, forms, shopping carts, settings pages — anything that feels like an app in the browser.

React is **not** a programming language. It is a tool you use **with** JavaScript (or TypeScript). This tutorial uses JavaScript.

---

## Words you will see a lot

Read this once. Come back when a word feels fuzzy.

- **Component:** A reusable piece of UI, usually a function that returns markup. A button, a card, a whole page — all can be components.
- **JSX:** HTML-looking syntax inside JavaScript files. React turns it into real elements.
- **Props:** Inputs you pass into a component, like arguments to a function. Parent → child.
- **State:** Data a component remembers. When state changes, React **re-renders** that component.
- **Render:** React drawing (or updating) the UI from your components.
- **Hook:** A function whose name starts with `use` (like `useState`) that lets a component use React features.
- **Event:** Something the user did: click, type, submit.
- **SPA (single-page app):** One HTML file; React swaps views without a full page reload.
- **Vite:** A tool that runs a dev server and builds your app. You will use it to start a project.
- **npm:** Node’s package manager. It installs libraries (including React).

---

## 1. What you need installed

### Node.js

React projects use **Node.js** so you can run a local server and install packages.

1. Download the **LTS** version from [https://nodejs.org](https://nodejs.org).
2. Install it with the defaults.

Check in Terminal (macOS/Linux) or Command Prompt / Git Bash (Windows):

```bash
node -v
npm -v
```

You should see version numbers (Node 20 or newer is a safe target).

### A code editor

[VS Code](https://code.visualstudio.com/) or Cursor is enough. Install the editor’s JavaScript/React highlighting if it is not already on.

---

## 2. Create a React app (Vite)

Open a terminal. Go to the folder where you keep projects, then:

```bash
npm create vite@latest hello-react -- --template react
cd hello-react
npm install
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`. Open it in the browser. You should see the default Vite + React page.

**What those commands did:**

| Command | Meaning |
| --- | --- |
| `npm create vite@latest ...` | Scaffold a new project |
| `--template react` | JavaScript + React (not TypeScript) |
| `npm install` | Download React and other packages into `node_modules` |
| `npm run dev` | Start the development server |

Leave the server running while you edit. Save a file and the browser should update on its own (**hot reload**).

Stop the server with `Ctrl+C`. Start it again anytime with `npm run dev`.

---

## 3. What is in the project folder?

You do not need every file on day one. These matter:

```text
hello-react/
  index.html          ← the one HTML page (React mounts here)
  package.json        ← project name, scripts, dependencies
  src/
    main.jsx          ← starts React and attaches it to the page
    App.jsx           ← your main component (start editing here)
    App.css           ← styles for App
    index.css         ← global styles
```

Open `index.html`. You will see a tag like:

```html
<div id="root"></div>
```

React draws your app **inside** that empty `div`. You almost never put your UI in `index.html` itself.

`src/main.jsx` looks roughly like this:

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Read it as:** find `#root`, render the `App` component there. `StrictMode` is a development helper that highlights problems; it is not visible to users.

---

## 4. JSX: HTML in JavaScript (with a few rules)

Open `src/App.jsx`. A component is a **function whose name starts with a capital letter** and **returns JSX**.

```jsx
function App() {
  return <h1>Hello, React</h1>;
}

export default App;
```

Replace the default Vite content with that, save, and check the browser.

### Rules that surprise beginners

**1. One parent.** Return one tree, not two siblings sitting loose.

```jsx
// Wrong
return (
  <h1>Title</h1>
  <p>Text</p>
);

// Right — wrap in a div, or a fragment <>...</>
return (
  <>
    <h1>Title</h1>
    <p>Text</p>
  </>
);
```

**2. `className`, not `class`.** `class` is a reserved word in JavaScript.

```jsx
<p className="intro">Hello</p>
```

**3. Curly braces for JavaScript.** Plain text is text. `{...}` inserts a value.

```jsx
const name = "Ada";
return <p>Hello, {name}</p>;
```

**4. Attributes that are objects or numbers use braces.**

```jsx
<img src={photoUrl} alt="A cat" width={200} />
```

**5. Self-closing tags must close.** In JSX, `<img />` and `<br />` need the slash.

**6. Almost everything is JavaScript.** Comments in JSX look like `{/* this */}`, not HTML comments.

---

## 5. Components: split the page into pieces

A page is easier when each piece has a job.

Create `src/Greeting.jsx`:

```jsx
function Greeting() {
  return <p>Welcome to your first component.</p>;
}

export default Greeting;
```

Use it in `App.jsx`:

```jsx
import Greeting from "./Greeting.jsx";

function App() {
  return (
    <main>
      <h1>Hello, React</h1>
      <Greeting />
    </main>
  );
}

export default App;
```

`<Greeting />` means: run the `Greeting` function and put its output here.

**Name components with PascalCase:** `UserCard`, not `userCard` or `user-card`. React treats lowercase names as HTML tags (`div`, `span`).

You can keep several small components in one file while you learn. Split into files when a file feels crowded.

---

## 6. Props: pass data into a component

Props are how a parent sends information down.

Update `Greeting.jsx`:

```jsx
function Greeting({ name }) {
  return <p>Hello, {name}.</p>;
}

export default Greeting;
```

In `App.jsx`:

```jsx
<Greeting name="Ada" />
<Greeting name="Grace" />
```

`name="Ada"` becomes the argument `{ name: "Ada" }`. You **destructure** it as `{ name }` so you can write `name` instead of `props.name`.

### Rules of thumb

- Props flow **down**. A child does not change the parent’s props.
- Treat props as **read-only**. To change what is on screen, use **state** (next section).
- You can pass strings, numbers, booleans, arrays, objects, and even functions.

```jsx
<Greeting name={firstName} />
<button onClick={handleClick}>Save</button>
```

---

## 7. State: data that can change

**State** is memory inside a component. When you update it, React re-renders and the UI matches the new data.

The hook you will use most is `useState`.

Replace `App.jsx` with a counter:

```jsx
import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <p>You clicked {count} times.</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </main>
  );
}

export default App;
```

### What that line means

```jsx
const [count, setCount] = useState(0);
```

- `0` is the **starting** value.
- `count` is the **current** value.
- `setCount` is the **only** way you should update it.

**Do not** write `count = count + 1`. React will not notice. Always call the setter: `setCount(count + 1)`.

When the new value depends on the old one, this form is safer (it uses the latest value even if updates queue up):

```jsx
setCount((current) => current + 1);
```

### State lives in one component

If `App` owns `count`, only `App` (or children it passes props to) can show that number. Lift state **up** to the closest parent that both children need. Do not try to “reach into” a sibling.

---

## 8. Events: clicks, typing, forms

In HTML you might write `onclick`. In React it is **camelCase** and you pass a **function**, not a string.

```jsx
function handleClick() {
  alert("Clicked");
}

return <button onClick={handleClick}>Go</button>;
```

Note: `onClick={handleClick}` — **no** `()`. With `onClick={handleClick()}` the function would run while rendering, not on click.

### A text box (controlled input)

“Controlled” means React state is the source of truth for the input’s value.

```jsx
import { useState } from "react";

function NameForm() {
  const [name, setName] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    alert(`Hello, ${name || "stranger"}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Name{" "}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ada"
        />
      </label>
      <button type="submit">Say hi</button>
    </form>
  );
}
```

- `event.preventDefault()` stops the browser from reloading the page on submit.
- `event.target.value` is what the user typed.

---

## 9. Lists: render arrays with `map`

To show a list, turn an array into an array of elements.

```jsx
const tasks = [
  { id: 1, text: "Install Node" },
  { id: 2, text: "Create a Vite app" },
  { id: 3, text: "Build a component" },
];

function TaskList() {
  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.text}</li>
      ))}
    </ul>
  );
}
```

**Always pass `key`** on the element you return from `map`. Use a **stable id** from your data, not the array index, if items can be reordered or deleted. Keys help React match each item across re-renders.

---

## 10. Showing things only sometimes

Use JavaScript, not a special React syntax.

```jsx
function Banner({ isLoggedIn }) {
  return (
    <header>
      {isLoggedIn ? <p>Welcome back.</p> : <p>Please sign in.</p>}
      {isLoggedIn && <button>Log out</button>}
    </header>
  );
}
```

- `? :` is “if this, then that, else the other.”
- `&&` is “if this is true, show that.” Avoid `&&` with the number `0` (it can print a zero). Prefer `count > 0 && ...` for counts.

---

## 11. CSS in a React app

**Option A — CSS files** (simplest)

```jsx
import "./App.css";

function App() {
  return <main className="page">Hello</main>;
}
```

In `App.css`:

```css
.page {
  max-width: 40rem;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
}
```

**Option B — inline styles** (an object, camelCase names)

```jsx
<p style={{ color: "navy", fontSize: 18 }}>Hello</p>
```

Start with CSS files. Inline styles are handy for values that come from state (for example a bar width).

---

## 12. A tiny project: todo list

Put this in `App.jsx` and make sure you understand each piece. Type it yourself; do not only paste.

```jsx
import { useState } from "react";

function App() {
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);

  function addItem(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setItems((current) => [
      ...current,
      { id: crypto.randomUUID(), text: trimmed },
    ]);
    setText("");
  }

  function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <main>
      <h1>Todos</h1>
      <form onSubmit={addItem}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Buy milk"
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.text}{" "}
            <button type="button" onClick={() => removeItem(item.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
```

**What you practiced:**

- `useState` for the input and the list
- spreading `[...current, newItem]` so you **replace** the array instead of mutating it
- `filter` to remove an item
- `map` + `key` to render the list
- `preventDefault` on the form

When this works, you already know the core of React: **UI = components(data)**. Change the data; the UI follows.

---

## 13. Things you can ignore on day one

You will see these in docs and blog posts. You do not need them to finish the todo list.

| Topic | What it is, in one line |
| --- | --- |
| TypeScript | JavaScript plus types. Learn JS React first. |
| Redux / Zustand | Extra libraries for sharing state across a huge app. |
| Next.js | A framework on top of React (routing, server rendering). Learn React first. |
| `useEffect` | Run code after render (fetch data, timers). Next step after this tutorial. |
| Context | Pass data deep down without props at every level. |
| Refs (`useRef`) | Talk to a DOM node (focus an input) without driving UI from state. |

A honest order: **components → props → state → lists → forms**, then `useEffect` and fetching data, then a router.

---

## 14. `useEffect` in one paragraph (preview)

When you need to **fetch data**, start a timer, or sync with something outside React, you use `useEffect`:

```jsx
import { useState, useEffect } from "react";

function TitleCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `Clicked ${count}`;
  }, [count]);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

The array `[count]` means: run this after render **when `count` changes**. An empty array `[]` means: run once after the first render. Skip this until the todo app feels easy.

---

## 15. Common mistakes

- **Forgot to import React hooks:** `import { useState } from "react"`.
- **Called the setter wrong:** `setCount(count + 1)`, not `count++`.
- **Mutated arrays/objects:** use a new array/object (`map`, `filter`, spread `...`).
- **Missing `key` on lists:** add a stable `id`.
- **`onClick={fn()}` instead of `onClick={fn}`:** that runs immediately.
- **Component named in lowercase:** React will think it is HTML.
- **Edited files but old page:** confirm `npm run dev` is still running and you saved.

---

## 16. Commands cheat sheet

| I want to… | Command or idea |
| --- | --- |
| New React app | `npm create vite@latest my-app -- --template react` |
| Install packages | `cd my-app` then `npm install` |
| Run locally | `npm run dev` |
| Production build | `npm run build` |
| New component | Function, capital name, `return` JSX, `export default` |
| Pass data down | Props: `<Child title="Hi" />` |
| Remember changing data | `const [x, setX] = useState(initial)` |
| Handle a click | `onClick={handler}` |
| Render a list | `array.map(item => <li key={item.id}>...</li>)` |

---

## Mini practice (about an hour)

Do these in order. Check the browser after each step.

1. Install Node and create a Vite React app.
2. Replace `App` with a heading and a paragraph.
3. Extract the paragraph into a `Bio` component in another file.
4. Pass your name as a prop.
5. Add a counter with `useState`.
6. Add a controlled text input that shows what you type underneath.
7. Build the todo list in section 12.
8. Extra: add a checkbox on each todo to mark it done (you will need another field on each item, or a `done` boolean).

If those work, you can read other people’s React code and change it on purpose.

---

## Where to go next

- Official React docs (start here): [https://react.dev/learn](https://react.dev/learn)
- Vite guide: [https://vite.dev/guide](https://vite.dev/guide)
- MDN JavaScript (when a JS feature is confusing): [https://developer.mozilla.org/en-US/docs/Web/JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

You do not need to memorize React. You need a loop: **split the UI into components, put changing data in state, pass the rest as props, let JSX describe the screen.**
