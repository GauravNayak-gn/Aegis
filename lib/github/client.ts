export async function addLabel(
  repoFullName: string,
  issueNumber: number,
  label: string,
  token: string
) {
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Automation-Bot",
      },
      body: JSON.stringify({
        labels: [label],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to add label: ${errorData.message || response.statusText}`
    );
  }

  return response.json();
}

export async function postComment(
  repoFullName: string,
  issueNumber: number,
  body: string,
  token: string
) {
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Automation-Bot",
      },
      body: JSON.stringify({
        body,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to post comment: ${errorData.message || response.statusText}`
    );
  }

  return response.json();
}
