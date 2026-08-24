import glob

files = glob.glob("src/app/api/milestones/**/route.ts", recursive=True) + glob.glob("src/app/api/tasks/**/route.ts", recursive=True)

for file in files:
    with open(file, "r") as f:
        content = f.read()
    
    # Replace the session checks
    content = content.replace(
        "if (!session?.user?.id && !session?.githubId) {\n    return new Response(\"Unauthorized\", { status: 401 });\n  }",
        "if (!session?.githubId) {\n    return new Response(\"Unauthorized\", { status: 401 });\n  }"
    )
    
    # Replace the user id retrieval
    content = content.replace(
        "const userId = session.user?.id || session.githubId;\n  const appUser = await resolveAppUser(userId, session.githubLogin);",
        "const appUser = await resolveAppUser(session.githubId, session.githubLogin);"
    )
    
    with open(file, "w") as f:
        f.write(content)
        
    print("Fixed", file)
