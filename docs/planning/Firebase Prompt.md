## Create Noise Lab Firebase Tutorial 
Please review my current Noise Lab project (project 2) first, but do not modify any code yet.

Create a concise, step-by-step tutorial for adding Firebase to this project. Write into a new md file named "Firebase_NoiseLab" under the tutorials folder:

 Requirements:
- Firebase Authentication
- Firestore
- Storage
- Hosting
- User data linked to login
- Save and load Noise Lab configurations
- Security Rules

For each step:
1. Tell me what I need to do manually in Firebase Console.
2. Tell me what files need to be created or modified in my project.
3. Give only the necessary commands or code.
4. Include a simple test to confirm the step works before moving on.

Use my existing project structure and current Noise Lab parameters.
Do not redesign or refactor the app yet.
Keep the tutorial simple, practical, and beginner-friendly.
Do not implement anything yet.

## Create Firebase Login
I also enabled Google Sign-In in Firebase.

Please include "Continue with Google" in the authentication UI in addition to Email/Password.

Keep the implementation simple and consistent with the existing Noise Lab design.

## Fix Google Account Login Issue
Google Sign-In is not completing successfully.

Current behavior:
- Google provider is enabled in Firebase Console.
- The Google account selection and 2FA flow works.
- After returning to the app, there is no error.
- However, no Google user appears in Firebase Authentication > Users.
- Email/Password authentication already works correctly.

Please debug the Google authentication flow only.

Check:
- GoogleAuthProvider setup
- signInWithPopup vs signInWithRedirect
- redirect result handling if redirect is used
- Firebase auth state after Google sign-in
- any caught/suppressed Firebase errors

Add temporary console logging if needed so we can see whether Google authentication actually succeeds.

Do not change the existing Email/Password authentication or UI design.
Make the minimum necessary fix.