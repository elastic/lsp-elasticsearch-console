# lsp-elasticsearch-console

A [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) implementation for the dev console HTTP request format used in [Kibana's dev console app](https://www.elastic.co/docs/explore-analyze/query-filter/tools/console).
When used with [elasticsearch.nvim](https://github.com/elastic/elasticsearch.nvim), provides auto-completion hints from the Elasticsearch specification.

**This project is still experimental!** Not intended for production use.

## Install

```sh
# clone and build the code
git clone https://github.com/elastic/lsp-elasticsearch-console.git
cd lsp-elasticsearch-console
npm run compile

# install the package
npm link
```
