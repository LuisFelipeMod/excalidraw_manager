# Nanquim

Gerenciador e editor desktop de desenhos **Excalidraw**, notas **Markdown** e
**PDFs** anotáveis — tudo em uma única janela, com os arquivos guardados
localmente na sua máquina.

O Nanquim embarca o próprio editor do [Excalidraw](https://excalidraw.com) como
componente React dentro do Electron. Não depende dos serviços online do
Excalidraw: seus documentos ficam em uma pasta no seu computador e você decide
se quer (opcionalmente) sincronizá-los com **Google Drive** ou um repositório
**Git**.

## Recursos

- 🎨 **Editor Excalidraw embarcado** para arquivos `.excalidraw`.
- 📝 **Editor Markdown** com pré-visualização e exportação para PDF.
- 📕 **Visualizador de PDF** com uma camada de anotações desenhada por cima
  (o PDF original nunca é modificado).
- 🗂️ **Gerenciador de arquivos** com árvore de pastas, abas, arrastar-e-soltar,
  criar / renomear / mover / duplicar / excluir.
- ⚡ **Busca rápida** de arquivos com `Ctrl/Cmd + P`.
- 💾 **Autosave** com escrita atômica em disco.
- ☁️ **Sincronização opcional** com Google Drive e/ou Git.
- 🔒 Isolamento de contexto do Electron; acesso ao disco mediado só pelo
  processo principal.

## Documentação

- 📘 [Guia do Usuário](docs/USUARIO.md) — como instalar e usar o Nanquim.
- 🛠️ [Guia do Desenvolvedor](docs/DESENVOLVEDOR.md) — arquitetura, ambiente de
  desenvolvimento e build.

## Início rápido (desenvolvimento)

```bash
git clone --recurse-submodules <url-do-repo> nanquim
cd nanquim/app
npm install
npm run dev
```

> O editor Excalidraw vem como **git submodule** em `external/excalidraw`. Se
> você clonou sem `--recurse-submodules`, rode `git submodule update --init`.

Requer **Node.js 20+**. Veja o [Guia do Desenvolvedor](docs/DESENVOLVEDOR.md)
para detalhes.

## Licença

Distribuído sob a licença [MIT](LICENSE) — © 2026 Luis Modesto.

O Excalidraw, incluído como submódulo em `external/excalidraw`, mantém a sua
própria licença (também MIT).
