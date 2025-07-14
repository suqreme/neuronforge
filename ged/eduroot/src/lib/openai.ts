import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export const generateLesson = async (topic: string, grade: string, userLevel: string) => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an AI tutor creating educational content for a ${grade} grade student at ${userLevel} level. 
        Create a comprehensive lesson on the topic: ${topic}.
        Format your response as JSON with the following structure:
        {
          "lesson": "detailed lesson content",
          "quiz": [
            {
              "question": "question text",
              "options": ["option1", "option2", "option3", "option4"],
              "correct": 0
            }
          ]
        }`
      }
    ],
    temperature: 0.7,
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}