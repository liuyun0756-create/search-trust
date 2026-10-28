# Capability PDF fonts

Bundled, offline static instances of Noto Sans SC, distributed under the accompanying unmodified SIL Open Font License (`OFL.txt`). They are only used by the new approved-report PDF renderer; the legacy renderer is unchanged.

- Source: https://github.com/google/fonts/tree/main/ofl/notosanssc
- Variable source: `NotoSansSC[wght].ttf`
- Source SHA-256: `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`
- Generated with FontTools 4.60.2: `python3 -m fontTools.varLib.instancer SOURCE wght=400 --update-name-table --no-recalc-timestamp --output=ReportSans-Regular.ttf` (700 for Bold). Updating the name table preserves distinct regular/bold PostScript identities for PDF embedding.
- Regular SHA-256: `eeb06b8a64fd04a2744d95579db1571b51027cda61ed78c62e4b730791525461`
- Bold SHA-256: `a8d8569e6cf8e93e830736e64c69568c5499ff65bf6a8ff860f0cdacc3eab7d0`

The renderer checks actual glyph coverage before rendering. Unsupported characters produce a controlled error rather than a silently corrupted PDF. This is not a promise of universal Unicode or emoji coverage. Preserve the license and both font files when packaging the application.
