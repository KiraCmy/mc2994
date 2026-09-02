# Git & GitHub 101

A simple guide for people who have never used Git or GitHub.

You do not need a computer science background. If you can type a command and create a folder, you can follow this.

---

## What problem does this solve?

Imagine you are writing a paper (or code, or a design file). You save `essay.docx`, then `essay_final.docx`, then `essay_final_v2_REALLY_FINAL.docx`. After a week you cannot remember which one is real.

**Git** keeps a history of your work. You can go back in time, see what changed, and try ideas without destroying the original.

**GitHub** is a website that stores Git projects online so you can back them up, share them, and work with other people.

| Tool | What it is | Where it lives |
| --- | --- | --- |
| Git | Version control software | On your computer |
| GitHub | Hosting + collaboration | On the internet |

Git works without GitHub. GitHub is useless without Git.

---

## Words you will see a lot

Read this once. Come back when a word feels fuzzy.

- **Repository (repo):** A project folder that Git is tracking. Like a box that remembers every saved version.
- **Commit:** A snapshot of your files at one moment, plus a short message explaining what you did. Like a save point in a game.
- **Working tree:** The files you see and edit right now.
- **Staging area:** A waiting room. You pick which changes go into the next commit.
- **Branch:** A parallel copy of the project so you can try something without breaking the main version.
- **Main (or master):** The default branch. Treat it as the “official” version.
- **Remote:** A copy of the repo somewhere else, usually GitHub.
- **Clone:** Download a repo from GitHub onto your computer.
- **Push:** Send your new commits to GitHub.
- **Pull:** Download new commits from GitHub onto your computer.
- **Pull request (PR):** A request on GitHub: “Please review these changes and merge them.”

---

## 1. Install Git

### macOS

Open **Terminal** (search for it in Spotlight). Then:

```bash
git --version
```

If Git is missing, macOS will offer to install developer tools. Accept that, or install Git from [https://git-scm.com/downloads](https://git-scm.com/downloads).

### Windows

Download Git from [https://git-scm.com/downloads](https://git-scm.com/downloads). During setup, keep the defaults. After install, use **Git Bash**.

### Check that it worked

```bash
git --version
```

You should see something like `git version 2.x.x`.

---

## 2. Tell Git who you are

Git stamps every commit with your name and email. Do this once on a new computer:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Use the same email you will use on GitHub.

Check your settings:

```bash
git config --global --list
```

---

## 3. Create your first repository (local only)

Pick a folder for a tiny practice project.

```bash
mkdir hello-git
cd hello-git
```

Turn the folder into a Git repo:

```bash
git init
```

Git creates a hidden `.git` folder. Do not edit it by hand. That folder *is* the history.

Create a file:

```bash
echo "Hello, Git" > README.md
```

See what Git thinks:

```bash
git status
```

You should see `README.md` listed as **untracked**. Git sees the file but is not saving it yet.

---

## 4. The three-step save: add, commit, repeat

Saving in Git is not the same as clicking Save in a text editor.

1. Edit files (normal Save in your editor).
2. **Stage** the files you want in the next snapshot (`git add`).
3. **Commit** the snapshot (`git commit`).

Stage the file:

```bash
git add README.md
```

Or stage everything in the folder:

```bash
git add .
```

Commit:

```bash
git commit -m "Add a short README"
```

The `-m` flag is the commit **message**. Write it in the present tense, like a caption: what this snapshot does.

Good messages:

- `Add a short README`
- `Fix typo in the intro`
- `Remove unused notes`

Bad messages:

- `stuff`
- `asdf`
- `final final`

Look at history:

```bash
git log --oneline
```

---

## 5. Make a change and see the diff

Edit `README.md` (add a second line). Then:

```bash
git status
git diff
```

- `git status` — what files changed
- `git diff` — the actual line-by-line changes (not yet staged)

Stage and commit again:

```bash
git add README.md
git commit -m "Add a second line to the README"
```

You now have two save points. You can always go back.

---

## 6. Branches (try ideas safely)

You are on `main` by default (some older setups use `master`).

Create a branch and switch to it:

```bash
git switch -c try-a-new-idea
```

(`git checkout -b try-a-new-idea` does the same thing on older Git.)

Make a change, then commit it on this branch. `main` stays untouched until you merge.

See branches:

```bash
git branch
```

The star `*` marks the branch you are on.

Switch back to main:

```bash
git switch main
```

Merge the idea into main:

```bash
git merge try-a-new-idea
```

If Git can combine the changes automatically, you are done. If two people edited the same lines, you get a **merge conflict** (covered later).

---

## 7. Create a GitHub account and a remote repo

1. Go to [https://github.com](https://github.com) and sign up.
2. Click **New repository**.
3. Name it `hello-git` (or anything you like).
4. Leave it **empty**: do **not** add a README, `.gitignore`, or license if you already have a local repo. Two starting histories are harder to combine.
5. Click **Create repository**.

GitHub will show a URL, often:

```text
https://github.com/YOUR_USERNAME/hello-git.git
```

or (SSH):

```text
git@github.com:YOUR_USERNAME/hello-git.git
```

HTTPS is simpler for a first day. SSH is nicer long-term once you set up a key.

---

## 8. Connect your computer to GitHub

In your local `hello-git` folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/hello-git.git
git remote -v
```

`origin` is just the usual nickname for “the GitHub copy.”

Push your commits:

```bash
git push -u origin main
```

`-u` remembers that this local `main` tracks GitHub’s `main`. Later you can run:

```bash
git push
```

Refresh the GitHub page. Your files should appear.

**If GitHub asks you to log in:** use a **personal access token** as the password for HTTPS (GitHub no longer accepts your account password for Git). Create one under GitHub → Settings → Developer settings → Personal access tokens.

---

## 9. Clone (start from GitHub instead)

If the project already exists on GitHub and you want it on a new computer:

```bash
cd ~/Documents
git clone https://github.com/YOUR_USERNAME/hello-git.git
cd hello-git
```

Clone copies the repo *and* sets `origin` for you. You do not run `git init` after a clone.

---

## 10. Everyday workflow

This is the loop you will use forever:

```bash
git pull                 # get other people's latest work (or your other computer's)
# ... edit files ...
git status               # see what changed
git diff                 # review the changes
git add .                # or add specific files
git commit -m "Explain the change"
git push                 # upload to GitHub
```

**Pull before you start work** (and before you push if someone else might have pushed). That keeps surprises small.

---

## 11. Pull requests (working with people)

A common team pattern:

1. You are **not** allowed to push straight to `main` (or you choose not to).
2. You create a branch: `git switch -c fix-typo`.
3. Commit, then `git push -u origin fix-typo`.
4. On GitHub, click **Compare & pull request**.
5. Describe what you changed. Ask for review.
6. After approval, **Merge**. GitHub puts your branch into `main`.
7. On your computer: `git switch main` then `git pull`.

A pull request is a conversation around a set of commits. It is not a Git command; it is a GitHub feature.

---

## 12. Merge conflicts (when Git needs you)

A conflict means two commits changed the **same lines** and Git will not guess.

Git marks the file like this:

```text
<<<<<<< HEAD
the version on your current branch
=======
the version coming in from the other branch
>>>>>>> other-branch
```

What to do:

1. Open the file.
2. Keep the correct text (or combine both).
3. Delete the `<<<<<<<`, `=======`, and `>>>>>>>` markers.
4. `git add` the file.
5. `git commit` (Git often prepares a merge message for you).

Conflicts are normal. They are not a broken repo.

---

## 13. `.gitignore`

Some files should never be committed: secrets, huge downloads, editor junk.

Create a file named `.gitignore` in the repo root:

```text
.DS_Store
*.log
.env
node_modules/
```

Commit that file. Git will stop listing those paths as changes.

**Never commit passwords, API keys, or `.env` files with secrets.** If you already did, change those secrets; deleting the file in a later commit does not erase them from history.

---

## 14. Commands cheat sheet

| I want to… | Command |
| --- | --- |
| Start a repo in this folder | `git init` |
| Copy a GitHub repo | `git clone URL` |
| See what changed | `git status` |
| See line-by-line edits | `git diff` |
| Stage a file | `git add filename` |
| Stage everything | `git add .` |
| Save a snapshot | `git commit -m "message"` |
| See history | `git log --oneline` |
| Create and switch to a branch | `git switch -c branch-name` |
| Switch branches | `git switch branch-name` |
| Merge a branch into the current one | `git merge branch-name` |
| Download from GitHub | `git pull` |
| Upload to GitHub | `git push` |
| Add the GitHub remote | `git remote add origin URL` |
| Undo unstaged edits in one file | `git restore filename` |
| Unstage a file (keep edits) | `git restore --staged filename` |

`git restore` is the modern way. Older tutorials use `git checkout` for some of the same jobs.

---

## 15. Habits that save you pain

- Commit **small, complete** chunks, not one giant commit at the end of the week.
- Write messages for a stranger (that stranger is you in three months).
- `git status` constantly. It is the map.
- Pull before you push.
- Do not rewrite shared history (`git push --force` on `main`) until you know why it is dangerous.
- Keep secrets out of Git.

---

## Mini practice (30 minutes)

Do this without skipping steps:

1. Install Git and set your name and email.
2. `mkdir practice && cd practice && git init`
3. Create `notes.md`, commit it.
4. Edit it, commit again.
5. Create a branch, change something, merge it back to `main`.
6. Create an empty GitHub repo and `git remote add` + `git push`.
7. Edit a file on GitHub in the browser, then `git pull` on your computer.

If those seven steps work, you know enough Git to start a real project.

---

## Where to go next

- Official Git book (free): [https://git-scm.com/book/en/v2](https://git-scm.com/book/en/v2)
- GitHub’s own guides: [https://docs.github.com/en/get-started](https://docs.github.com/en/get-started)

You do not need to memorize Git. You need a tiny loop: **edit → add → commit → push**, plus **pull** when the remote might have changed.
)