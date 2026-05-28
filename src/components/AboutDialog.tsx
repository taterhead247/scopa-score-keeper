import { marked } from 'marked'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import pkg from '../../package.json'

/** Translation helper signature shared across the app. */
type Tr = (key: string, params?: Record<string, string>) => string

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tr: Tr
}

const PRIVACY_POLICY_URL_EN =
  'https://github.com/taterhead247/scopa-score-keeper/blob/main/PRIVACY.md'
const PRIVACY_POLICY_URL_IT =
  'https://github.com/taterhead247/scopa-score-keeper/blob/main/PRIVACY.it.md'
const ISSUES_URL = 'https://github.com/taterhead247/scopa-score-keeper/issues'

/**
 * Render a small subset of Markdown (bold + lists + paragraphs) the issue
 * content uses. We rely on `marked` (already a dep) configured in sync mode;
 * the rendered HTML is injected with dangerouslySetInnerHTML because the
 * content is fully app-controlled translation strings — no user input.
 */
function md(source: string): { __html: string } {
  return { __html: marked.parse(source, { async: false }) as string }
}

/**
 * About / Help dialog (#58).
 *
 * Three collapsible sections — rules, how-to, about — driven by the
 * existing Radix Accordion. First section is expanded by default so the
 * dialog opens to "How to play" (the most useful for first-time players).
 * Version is read from package.json at build time; localization keys
 * substitute `{version}` so we never hardcode a string.
 */
export function AboutDialog({ open, onOpenChange, tr }: Props) {
  const privacyUrl =
    tr('app.title') === 'Scopa — Segnapunti' ? PRIVACY_POLICY_URL_IT : PRIVACY_POLICY_URL_EN

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('about.title')}</DialogTitle>
        </DialogHeader>

        <Accordion type="single" collapsible defaultValue="rules" className="w-full">
          <AccordionItem value="rules">
            <AccordionTrigger>{tr('about.section.rules')}</AccordionTrigger>
            <AccordionContent>
              <div
                className="prose prose-sm max-w-none [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_li]:mb-1"
                dangerouslySetInnerHTML={md(tr('about.rules.body'))}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="howto">
            <AccordionTrigger>{tr('about.section.howto')}</AccordionTrigger>
            <AccordionContent>
              <div
                className="prose prose-sm max-w-none [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_li]:mb-1"
                dangerouslySetInnerHTML={md(tr('about.howto.body'))}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="about">
            <AccordionTrigger>{tr('about.section.about')}</AccordionTrigger>
            <AccordionContent>
              <div
                className="prose prose-sm max-w-none [&_strong]:font-semibold [&_p]:mb-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-xs"
                dangerouslySetInnerHTML={md(tr('about.about.body', { version: pkg.version }))}
              />
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="text-muted-foreground">{tr('about.link.license')}</li>
                <li>
                  <a
                    href={privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {tr('about.link.privacy')}
                  </a>
                </li>
                <li>
                  <a
                    href={ISSUES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {tr('about.link.issues')}
                  </a>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            {tr('about.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
