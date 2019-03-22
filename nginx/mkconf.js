process.stdout.write(`   location / {
        proxy_pass http://${process.env.npm_package_config_listen_ip}:${process.env.npm_package_config_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
`);
