export async function sendSlackNotification(
  webhookUrl: string,
  messageText: string,
  blocks?: any[]
) {
  const payload: any = {
    text: messageText,
  };

  if (blocks) {
    payload.blocks = blocks;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to send Slack notification: ${response.statusText} (${errorText})`
    );
  }

  return true;
}
