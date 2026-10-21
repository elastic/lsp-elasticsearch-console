# lsp-elasticsearch-console

A [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) implementation for the dev console HTTP request format used in [Kibana's dev console app](https://www.elastic.co/docs/explore-analyze/query-filter/tools/console).
When used with [elasticsearch.nvim](https://github.com/elastic/elasticsearch.nvim), provides auto-completion hints from the Elasticsearch specification.

**This project is still experimental!** Not intended for production use.

## Features

- **HTTP method autocomplete**: Autocomplete suggestions for HTTP methods (GET, POST, PUT, DELETE, HEAD, etc.)
- **API path autocomplete**: Autocomplete suggestions for Elasticsearch API paths
- **Placeholder resolution**: URL path autocomplete suggestions include real index names, pulled from the connected Elasticsearch cluster
- **Hover Documentation**: Display endpoint documentation when hovering over API calls

## Install

```sh
# clone and build the code
git clone https://github.com/elastic/lsp-elasticsearch-console.git
cd lsp-elasticsearch-console
npm run compile

# install the package
npm link
```

## License

Licensed under the Apache License, Version 2.0.
