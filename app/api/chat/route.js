import { OpenAI } from "openai";

const openai = new OpenAI(process.env.NEXT_PUBLIC_OPENAI_API_KEY);

const statusCheckLoop = async (openAiThreadId, runId) => {
  const run = await openai.beta.threads.runs.retrieve(openAiThreadId, runId);
  const terminalStates = ["cancelled", "failed", "completed", "expired"];

  if (terminalStates.indexOf(run.status) < 0) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return statusCheckLoop(openAiThreadId, runId);
  }

  return run.status;
};

export async function POST(request) {
  const { query, history } = await request.json();

  try {
    const thread = await openai.beta.threads.create();
    const openAiThreadId = thread.id;

    await openai.beta.threads.messages.create(openAiThreadId, {
      role: "user",
      content: query,
    });

    const run = await openai.beta.threads.runs.create(openAiThreadId, {
      assistant_id: process.env.ASSISTANT_ID,
      tools: [{ type: "code_interpreter" }, { type: "file_search" }],
    });

    await statusCheckLoop(openAiThreadId, run.id);

    const messages = await openai.beta.threads.messages.list(openAiThreadId);
    const responseMessage = messages.data[0].content[0].text.value;

    return new Response(
      JSON.stringify({
        role: "assistant",
        content: responseMessage,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Error fetching response from OpenAI" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
