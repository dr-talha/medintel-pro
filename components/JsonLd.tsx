type JsonLdProps = {
  schema: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
};

function serializeSchema(schema: JsonLdProps['schema']) {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export default function JsonLd({ schema, id }: JsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }}
    />
  );
}
