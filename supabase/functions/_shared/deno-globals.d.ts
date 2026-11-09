/** Ambient Deno globals for editors without the Deno extension. */
declare namespace Deno {
  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
  namespace env {
    function get(key: string): string | undefined;
  }
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(...args: any[]): any;
}
