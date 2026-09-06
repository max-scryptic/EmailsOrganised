/**
 * Example emails, as the setup chat collects them.
 *
 * The chat asks for examples of the mail a workflow is meant to catch, and the
 * person answers in a form (a subject and a body per email) rather than by
 * describing them in a sentence. This module owns the two things both ends of
 * that exchange need: what one example is, and how a set of them is written
 * into the single chat message the model reads. Pure and synchronous, so the
 * transcript, the message posted to the server, and the model all read one
 * rendering of the same examples.
 *
 * Counter-examples (mail that looks similar and should be left alone) are the
 * same shape and are deliberately a second, optional list. The assistant does
 * not ask for them; they are here only when the person chose to add some.
 */

export type ExampleEmail = {
  id: string;
  subject: string;
  body: string;
};

/**
 * How long one chat message may be. The example composer is the only writer
 * that can realistically approach it (a pasted email body is longer than
 * anything anyone types by hand), so the limit lives beside the thing that has
 * to respect it, and `workflowChatMessageSchema` reads it from here rather than
 * restating the number.
 */
export const chatMessageMaxLength = 4000;

/** Bounds on one field, so a paste cannot spend the whole message on its own. */
export const exampleSubjectMaxLength = 200;
export const exampleBodyMaxLength = 1500;

const wantedHeading = "Here are examples of the emails I want caught.";
const leaveAloneHeading =
  "These ones look similar but should be left alone.";

export function createExampleEmail(id: string): ExampleEmail {
  return { id, subject: "", body: "" };
}

/** An example with nothing in it is a row the person has not filled in yet. */
export function isExampleFilled(example: ExampleEmail) {
  return Boolean(example.subject.trim() || example.body.trim());
}

function describeOne(example: ExampleEmail, label: string, index: number) {
  const lines = [`${label} ${index + 1}`];
  const subject = example.subject.trim();
  const body = example.body.trim();

  if (subject) {
    lines.push(`Subject: ${subject}`);
  }

  if (body) {
    lines.push("Body:", body);
  }

  return lines.join("\n");
}

function describeGroup(
  examples: ExampleEmail[],
  heading: string,
  label: string
) {
  const filled = examples.filter(isExampleFilled);

  if (filled.length === 0) {
    return [];
  }

  return [
    heading,
    ...filled.map((example, index) => describeOne(example, label, index)),
  ];
}

/**
 * The examples as one message in the user's voice.
 *
 * Empty rows are dropped rather than sent as blanks, and a group nobody filled
 * in leaves no trace, which is how an unopened counter-example section stays
 * invisible to the model instead of arriving as an empty heading it has to
 * interpret.
 */
export function describeExampleEmails({
  examples,
  counterExamples = [],
}: {
  examples: ExampleEmail[];
  counterExamples?: ExampleEmail[];
}) {
  return [
    ...describeGroup(examples, wantedHeading, "Example"),
    ...describeGroup(counterExamples, leaveAloneHeading, "Counter-example"),
  ].join("\n\n");
}
