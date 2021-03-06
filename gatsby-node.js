const hasOwnProp = require('has-own-prop');
const R = require('ramda');

const productTemplate = require.resolve('./src/templates/product/index.jsx');
const cartTemplate = require.resolve('./src/templates/cart/index.jsx');
const catalogTemplate = require.resolve('./src/templates/catalog/index.jsx');
const mainPageTemplate = require.resolve('./src/templates/main/index.jsx');
const policyTemplate = require.resolve('./src/templates/policy/index.jsx');
const blogTemplate = require.resolve('./src/templates/blog/index.jsx');
const pageTemplate = require.resolve('./src/templates/page/index.jsx');
const articleTemplate = require.resolve(
  './src/templates/blog/article/index.jsx'
);

const typeDefs = require('./typedefs');

let isShopifyLite = false;
let enableWebp = true;

// Used as workaround (together with cache) to store and access Blogs ids and handles while creating fields for Articles
let availableBlogs = [];

function removeTrailingLeadingSlashes(string) {
  return string.replace(/^\/*|\/*$/g, '');
}

const getMainPageHandles = (mainPage) => {
  const handles = [];
  mainPage.forEach((element) => {
    if (element.type === 'collection' || element.type === 'product') {
      handles.push(element.handle);
    } else if (
      (element.type === 'carousel' || element.type === 'header') &&
      element.children.length > 0
    ) {
      element.children.forEach((e) => {
        handles.push(e.handle);
      });
    }
  });
  return handles;
};

const createProductNode = (options, actions, node) => {
  let { basePath = '', productPageBasePath = 'product' } = options;
  const { createNodeField } = actions;
  basePath = removeTrailingLeadingSlashes(basePath);
  productPageBasePath = removeTrailingLeadingSlashes(productPageBasePath);

  // Todo: Improve the way this is done. Maybe using the config.json file.
  createNodeField({
    node,
    name: 'shopifyThemePath',
    value: `${basePath && `/${basePath}`}/${productPageBasePath}/${
      node.handle
    }`,
  });

  createNodeField({
    node,
    name: 'firstImage',
    value: node.images[0] ? node.images[0] : {},
  });
};

const createCollectionNode = (options, actions, node) => {
  let { basePath = '', collectionPageBasePath = 'collection' } = options;
  const { createNodeField } = actions;
  basePath = removeTrailingLeadingSlashes(basePath);
  collectionPageBasePath = removeTrailingLeadingSlashes(collectionPageBasePath);
  // Todo: Improve the way this is done. Maybe using the config.json file.
  createNodeField({
    node,
    name: 'shopifyThemePath',
    value: `${basePath && `/${basePath}`}/${collectionPageBasePath}/${
      node.handle
    }`,
  });
};

const createShopPolicyNode = (options, actions, node) => {
  let { basePath = '', policyPageBasePath = 'policy' } = options;
  const { createNodeField } = actions;
  basePath = removeTrailingLeadingSlashes(basePath);
  policyPageBasePath = removeTrailingLeadingSlashes(policyPageBasePath);
  // Todo: Improve the way this is done. Maybe using the config.json file.
  createNodeField({
    node,
    name: 'shopifyThemePath',
    value: `${basePath && `/${basePath}`}/${policyPageBasePath}/${node.type}`,
  });
};

const createPageNode = (options, actions, node) => {
  let { basePath = '', pageBasePath = 'pages' } = options;
  const { createNodeField } = actions;
  basePath = removeTrailingLeadingSlashes(basePath);
  pageBasePath = removeTrailingLeadingSlashes(pageBasePath);
  // Todo: Improve the way this is done. Maybe using the config.json file.
  createNodeField({
    node,
    name: 'shopifyThemePath',
    value: `${basePath && `/${basePath}`}${
      pageBasePath && `/${pageBasePath}`
    }/${node.handle}`,
  });
};

const createBlogNode = async (options, actions, node, cache) => {
  let { basePath = '', blogPageBasePath = 'blog' } = options;
  const { createNodeField } = actions;
  basePath = removeTrailingLeadingSlashes(basePath);
  if (blogPageBasePath.length > 0) {
    blogPageBasePath = removeTrailingLeadingSlashes(blogPageBasePath);
  }
  const nodeUrlArray = node.url.split('/');
  const blogHandle = nodeUrlArray[nodeUrlArray.length - 1];
  // As while creating only new nodes we do not know about already existing
  // We need to store information about blogs received early in cache.
  // 1. Push new blogs to array
  availableBlogs.push({
    shopifyId: node.shopifyId,
    handle: blogHandle,
  });
  // 2. Receive already known blogs from cache
  const blogs = await cache.get('availableBlogs');
  // 3. Concat new blogs with already known
  if (blogs && blogs.length > 0) {
    availableBlogs = availableBlogs.concat(blogs);
  }
  // 4. Write back to cache
  await cache.set('availableBlogs', availableBlogs);
  // Todo: Improve the way this is done. Maybe using the config.json file.
  createNodeField({
    node,
    name: 'shopifyThemePath',
    value: `${basePath && `/${basePath}`}${
      blogPageBasePath && `/${blogPageBasePath}`
    }/${blogHandle}`,
  });
};

const createArticleNode = async (options, actions, node, cache) => {
  let {
    basePath = '',
    articlePageBasePath = 'article',
    blogPageBasePath = 'blog',
  } = options;
  const { createNodeField } = actions;
  basePath = removeTrailingLeadingSlashes(basePath);
  blogPageBasePath = removeTrailingLeadingSlashes(blogPageBasePath);
  if (articlePageBasePath.length > 0) {
    articlePageBasePath = removeTrailingLeadingSlashes(articlePageBasePath);
  }
  const nodeArticleUrlArray = node.url.split('/');
  const articleHandle = nodeArticleUrlArray[nodeArticleUrlArray.length - 1];
  const blogs = await cache.get('availableBlogs');
  blogs.forEach((blog) => {
    const { shopifyId, handle: blogHandle } = blog;
    if (shopifyId === node.blog.id) {
      createNodeField({
        node,
        name: 'shopifyThemePath',
        value: `${basePath && `/${basePath}`}${
          blogPageBasePath && `/${blogPageBasePath}`
        }/${blogHandle}${
          articlePageBasePath && `/${articlePageBasePath}`
        }/${articleHandle}`,
      });
    }
  });
};

const createMainPage = async (basePath, graphql, createPage) => {
  const mainPagePath = `${basePath && `/${basePath}`}/`;
  const mainPageHandles = await graphql(`
    {
      site {
        siteMetadata {
          gatsbyStorefrontConfig {
            mainPage {
              handle
              type
              children {
                handle
                type
              }
            }
          }
        }
      }
    }
  `);
  const mainPageHandlesArray = getMainPageHandles(
    JSON.parse(
      JSON.stringify(
        mainPageHandles.data.site.siteMetadata.gatsbyStorefrontConfig.mainPage
      )
    )
  );
  createPage({
    path: mainPagePath,
    component: mainPageTemplate,
    context: {
      handles: mainPageHandlesArray,
      enableWebp,
    },
  });
};

const createCollectionsPages = async (
  graphql,
  productsPerCollectionPage,
  createPage,
  finalCartPagePath,
  collectionTitles
) => {
  const filter = collectionTitles ? `title: {in: ["${collectionTitles.split(',').join('\",\"')}"]}` : "";
  const queryCollections = await graphql(`
    {
      collections: allShopifyCollection (filter: {${filter}}) {
        nodes {
          handle
          products {
            id
          }
          fields {
            shopifyThemePath
          }
        }
      }
    }
  `);

  if (
    queryCollections &&
    queryCollections.data &&
    R.hasPath(['collections', 'nodes'], queryCollections.data)
  ) {
    queryCollections.data.collections.nodes.forEach(
      ({ handle, products, fields }) => {
        const { shopifyThemePath } = fields;
        const collectionProductsCount = products.length;
        const productsPerPage = parseInt(productsPerCollectionPage, 10);
        const numPages = Math.ceil(collectionProductsCount / productsPerPage);
        Array.from({
          length: numPages,
        }).forEach((_, i) => {
          createPage({
            path:
              i === 0 ? `${shopifyThemePath}` : `${shopifyThemePath}/${i + 1}`,
            component: catalogTemplate,
            context: {
              handle,
              shopifyThemePath,
              limit: productsPerPage,
              skip: i * productsPerPage,
              numPages,
              currentPage: i + 1,
              // Todo: Find a better way to do this.
              cartUrl: finalCartPagePath,
              enableWebp,
            },
          });
        });
      }
    );
  }
};

const createProductsPages = async (graphql, createPage, finalCartPagePath, productTags) => {
  const filter = productTags ? `tags: {in: ["${productTags.split(',').join('\",\"')}"]}` : "";
  const queryProducts = await graphql(`
    {
      products: allShopifyProduct (filter: {${filter}}) {
        nodes {
          handle
          fields {
            shopifyThemePath
          }
        }
      }
    }
  `);
  queryProducts.data.products.nodes.forEach(({ handle, fields }) => {
    const { shopifyThemePath } = fields;
    createPage({
      path: shopifyThemePath,
      component: productTemplate,
      context: {
        handle,
        // Todo: Find a better way to do this.
        cartUrl: finalCartPagePath,
        enableWebp,
      },
    });
  });
};

const createPoliciesPages = async (graphql, createPage, finalCartPagePath) => {
  const queryPolicies = await graphql(`
    {
      policies: allShopifyShopPolicy {
        nodes {
          type
          fields {
            shopifyThemePath
          }
        }
      }
    }
  `);
  if (
    queryPolicies &&
    queryPolicies.data &&
    R.hasPath(['policies', 'nodes'], queryPolicies.data)
  ) {
    queryPolicies.data.policies.nodes.forEach(({ type, fields }) => {
      const { shopifyThemePath } = fields;
      createPage({
        path: shopifyThemePath,
        component: policyTemplate,
        context: {
          type,
          // Todo: Find a better way to do this.
          cartUrl: finalCartPagePath,
        },
      });
    });
  }
};

const createPagePages = async (graphql, createPage, finalCartPagePath) => {
  const queryPages = await graphql(`
    {
      pages: allShopifyPage {
        nodes {
          handle
          fields {
            shopifyThemePath
          }
        }
      }
    }
  `);
  if (
    queryPages &&
    queryPages.data &&
    R.hasPath(['pages', 'nodes'], queryPages.data)
  ) {
    queryPages.data.pages.nodes.forEach(({ handle, fields }) => {
      const { shopifyThemePath } = fields;
      createPage({
        path: shopifyThemePath,
        component: pageTemplate,
        context: {
          handle,
          // Todo: Find a better way to do this.
          cartUrl: finalCartPagePath,
        },
      });
    });
  }
};

const createArticlePages = async (graphql, createPage, finalCartPagePath) => {
  const queryArticles = await graphql(`
    {
      articles: allShopifyArticle {
        nodes {
          shopifyId
          fields {
            shopifyThemePath
          }
          blog {
            shopifyId
          }
        }
      }
    }
  `);
  if (
    queryArticles &&
    queryArticles.data &&
    R.hasPath(['articles', 'nodes'], queryArticles.data)
  ) {
    queryArticles.data.articles.nodes.forEach(({ shopifyId, fields }) => {
      const { shopifyThemePath } = fields;
      createPage({
        path: shopifyThemePath,
        component: articleTemplate,
        context: {
          shopifyId,
          // Todo: Find a better way to do this.
          cartUrl: finalCartPagePath,
        },
      });
    });
    return queryArticles;
  }
};

const createBlogPages = async (
  graphql,
  queryArticles,
  articlesPerBlogPage,
  createPage,
  finalCartPagePath
) => {
  const queryBlogs = await graphql(`
    {
      blogs: allShopifyBlog {
        nodes {
          shopifyId
          fields {
            shopifyThemePath
          }
        }
      }
    }
  `);
  if (
    queryBlogs &&
    queryBlogs.data &&
    R.hasPath(['blogs', 'nodes', queryBlogs.data])
  ) {
    queryBlogs.data.blogs.nodes.forEach(({ shopifyId, fields }) => {
      const { shopifyThemePath } = fields;
      const articlesArray = queryArticles.data.articles.nodes.filter((node) => {
        return shopifyId === node.blog.shopifyId;
      });
      const articlesCount = articlesArray.length;
      const articlesPerPage = parseInt(articlesPerBlogPage, 10);
      const numPages = Math.ceil(articlesCount / articlesPerPage);
      Array.from({
        length: numPages,
      }).forEach((_, i) => {
        createPage({
          path:
            i === 0 ? `${shopifyThemePath}` : `${shopifyThemePath}/${i + 1}`,
          component: blogTemplate,
          context: {
            shopifyId,
            shopifyThemePath,
            limit: articlesPerPage,
            skip: i * articlesPerPage,
            numPages,
            currentPage: i + 1,
            // Todo: Find a better way to do this.
            cartUrl: finalCartPagePath,
          },
        });
      });
    });
  }
};

exports.onPreInit = (_, pluginOptions) => {
  isShopifyLite = hasOwnProp(pluginOptions, 'shopifyLite')
    ? pluginOptions.shopifyLite
    : false;
  enableWebp = hasOwnProp(pluginOptions, 'enableWebp')
    ? pluginOptions.enableWebp
    : true;
};

exports.onCreateNode = async ({ node, actions, cache }, options) => {
  switch (node.internal.type) {
    case `ShopifyProduct`:
      createProductNode(options, actions, node);
      break;
    case `ShopifyCollection`:
      createCollectionNode(options, actions, node);
      break;
    case `ShopifyShopPolicy`:
      createShopPolicyNode(options, actions, node);
      break;
    case `ShopifyPage`:
      createPageNode(options, actions, node);
      break;
    case `ShopifyBlog`:
      await createBlogNode(options, actions, node, cache);
      break;
    case `ShopifyArticle`:
      await createArticleNode(options, actions, node, cache);
      break;
    default: // do nothing
  }
};

exports.createPages = async ({ graphql, actions }, options) => {
  const gatsbyStorefrontConfig = await graphql(`
    {
      site {
        siteMetadata {
          gatsbyStorefrontConfig {
            productsPerCollectionPage
            articlesPerBlogPage
          }
        }
      }
    }
  `);
  const {
    productsPerCollectionPage = 9,
    articlesPerBlogPage = 6,
  } = gatsbyStorefrontConfig.data.site.siteMetadata.gatsbyStorefrontConfig;

  const { createPage } = actions;
  let { cartPagePath = 'cart', basePath = '' } = options;
  basePath = removeTrailingLeadingSlashes(basePath);
  cartPagePath = removeTrailingLeadingSlashes(cartPagePath);

  const finalCartPagePath = `${basePath && `/${basePath}`}/${cartPagePath}`;
  createPage({
    path: finalCartPagePath,
    component: cartTemplate,
  });

  await createMainPage(basePath, graphql, createPage);

  await createCollectionsPages(
    graphql,
    productsPerCollectionPage,
    createPage,
    finalCartPagePath,
    options.collectionTitles
  );

  await createProductsPages(graphql, createPage, finalCartPagePath, options.productTags);

  await createPoliciesPages(graphql, createPage, finalCartPagePath);

  // In case Shopify Lite plan we don't have data to create Pages, Blogs and Articles
  if (!isShopifyLite) {
    await createPagePages(graphql, createPage, finalCartPagePath);

    const queryArticles = await createArticlePages(
      graphql,
      createPage,
      finalCartPagePath
    );

    await createBlogPages(
      graphql,
      queryArticles,
      articlesPerBlogPage,
      createPage,
      finalCartPagePath
    );
  }
};

exports.createSchemaCustomization = ({ actions }) => {
  // Here we define types.
  // We need it in case some data wasn't set up, but queries need to pass verification during build process.
  // While build process GatsbyJS extracts queries and checks them against schema (see https://www.gatsbyjs.org/docs/query-extraction/).

  const { createTypes } = actions;
  createTypes(typeDefs);
};
