import { streamClaude, callClaude, logger } from '@venueiq/shared-utils';

const SYSTEM_PROMPT = `You are VenueIQ's AI advisor — an expert in sports and entertainment venue operations.
You've been given a question from a venue operator and the data that answers it.

Rules:
1. Answer directly and specifically — lead with the key number or insight.
2. Use the data provided — never fabricate or estimate beyond what the data shows.
3. If data is empty, say so explicitly: "The data shows no results for this period."
4. Include a brief recommendation where relevant (1 sentence).
5. Keep responses concise: under 200 words for simple questions, under 400 for complex ones.
6. Format numbers clearly: use $ for currency, % for percentages, commas for large numbers.
7. If the question compares time periods, always show both values and the delta.`;

export const answerGeneratorService = {
  async* generateStreamingAnswer(
    tenantId: string,
    question: string,
    queryResult: unknown[],
    queryExplanation: string,
  ): AsyncGenerator<string> {
    const dataStr = queryResult.length === 0
      ? 'No data found for this query.'
      : JSON.stringify(queryResult.slice(0, 50), null, 2); // limit to 50 rows for context

    const userMessage = `Question: "${question}"

Query explanation: ${queryExplanation}

Data (${queryResult.length} rows${queryResult.length > 50 ? ', showing first 50' : ''}):
${dataStr}

Answer the question based on this data.`;

    yield* streamClaude({
      tenant_id: tenantId,
      service: 'nlq_answer_generator',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 600,
    });
  },

  async generateAnswer(
    tenantId: string,
    question: string,
    queryResult: unknown[],
    queryExplanation: string,
  ): Promise<string> {
    const dataStr = queryResult.length === 0
      ? 'No data found for this query.'
      : JSON.stringify(queryResult.slice(0, 50), null, 2);

    const response = await callClaude({
      tenant_id: tenantId,
      service: 'nlq_answer_generator',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Question: "${question}"\n\nQuery: ${queryExplanation}\n\nData:\n${dataStr}\n\nAnswer the question.` }],
      max_tokens: 600,
    });

    return response.content;
  },
};
